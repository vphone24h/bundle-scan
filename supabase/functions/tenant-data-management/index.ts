import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Rate limiting - very restrictive for destructive operations
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const supabaseUrlRL = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKeyRL = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const rlClient = createClient(supabaseUrlRL, supabaseServiceKeyRL, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: allowed } = await rlClient.rpc('check_rate_limit', { _function_name: 'tenant-data-management', _ip_address: clientIP, _max_requests: 5, _window_minutes: 60 })
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Không có quyền truy cập' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' }
    })

    // Verify caller
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Không thể xác thực người dùng' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action, tenantId, password, confirmText, restoreOption, deleteMode } = body

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Thiếu action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caller's tenant and role
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('tenant_id, user_role')
      .eq('user_id', caller.id)
      .single()

    const { data: platformUser } = await supabaseAdmin
      .from('platform_users')
      .select('tenant_id, platform_role')
      .eq('user_id', caller.id)
      .single()

    const callerTenantId = tenantId || userRole?.tenant_id || platformUser?.tenant_id
    const isSupperAdmin = userRole?.user_role === 'super_admin'
    const isPlatformAdmin = platformUser?.platform_role === 'platform_admin'

    // Only Super Admin or Platform Admin can perform these actions
    if (!isSupperAdmin && !isPlatformAdmin) {
      return new Response(
        JSON.stringify({ error: 'Chỉ Super Admin mới có quyền thực hiện' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!callerTenantId) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy thông tin cửa hàng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      case 'toggle_data_visibility': {
        const { isHidden, password: togglePassword } = body

        // Verify password
        if (!togglePassword) {
          return new Response(
            JSON.stringify({ error: 'Vui lòng nhập mật khẩu' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Verify password by signing in
        const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
          email: caller.email!,
          password: togglePassword,
        })

        if (signInError) {
          return new Response(
            JSON.stringify({ error: 'Mật khẩu không đúng' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // If enabling test mode, backup data first
        if (isHidden === true) {
          // Backup products
          const { data: products } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('tenant_id', callerTenantId)

          if (products && products.length > 0) {
            // Delete old backup first
            await supabaseAdmin.from('products_backup').delete().eq('tenant_id', callerTenantId)
            await supabaseAdmin.from('products_backup').insert({
              tenant_id: callerTenantId,
              data: products,
            })
          }

          // Backup import_receipts
          const { data: importReceipts } = await supabaseAdmin
            .from('import_receipts')
            .select('*')
            .eq('tenant_id', callerTenantId)

          if (importReceipts && importReceipts.length > 0) {
            await supabaseAdmin.from('import_receipts_backup').delete().eq('tenant_id', callerTenantId)
            await supabaseAdmin.from('import_receipts_backup').insert({
              tenant_id: callerTenantId,
              data: importReceipts,
            })
          }

          // Backup export_receipts
          const { data: exportReceipts } = await supabaseAdmin
            .from('export_receipts')
            .select('*')
            .eq('tenant_id', callerTenantId)

          if (exportReceipts && exportReceipts.length > 0) {
            await supabaseAdmin.from('export_receipts_backup').delete().eq('tenant_id', callerTenantId)
            await supabaseAdmin.from('export_receipts_backup').insert({
              tenant_id: callerTenantId,
              data: exportReceipts,
            })
          }

          // Backup cash_book
          const { data: cashBook } = await supabaseAdmin
            .from('cash_book')
            .select('*')
            .eq('tenant_id', callerTenantId)

          if (cashBook && cashBook.length > 0) {
            await supabaseAdmin.from('cash_book_backup').delete().eq('tenant_id', callerTenantId)
            await supabaseAdmin.from('cash_book_backup').insert({
              tenant_id: callerTenantId,
              data: cashBook,
            })
          }

          // Update tenant with backup flag
          const { data: updateData, error: updateError } = await supabaseAdmin
            .from('tenants')
            .update({ is_data_hidden: true, has_data_backup: true })
            .eq('id', callerTenantId)
            .select('id, is_data_hidden')
            .single()

          if (updateError) {
            console.error('Error updating tenant:', updateError)
            return new Response(
              JSON.stringify({ error: 'Không thể cập nhật trạng thái: ' + updateError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          console.log('Update result:', updateData)

          // Log action
          await supabaseAdmin.from('audit_logs').insert({
            tenant_id: callerTenantId,
            user_id: caller.id,
            action_type: 'ENABLE_TEST_MODE',
            table_name: 'tenants',
            description: 'Bật chế độ Test - Đã backup dữ liệu gốc',
          })
        } else {
          // Just turn off visibility, don't change data
          const { data: updateData, error: updateError } = await supabaseAdmin
            .from('tenants')
            .update({ is_data_hidden: false })
            .eq('id', callerTenantId)
            .select('id, is_data_hidden')
            .single()

          if (updateError) {
            console.error('Error updating tenant:', updateError)
            return new Response(
              JSON.stringify({ error: 'Không thể cập nhật trạng thái: ' + updateError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          console.log('Update result:', updateData)

          await supabaseAdmin.from('audit_logs').insert({
            tenant_id: callerTenantId,
            user_id: caller.id,
            action_type: 'DISABLE_TEST_MODE',
            table_name: 'tenants',
            description: 'Tắt chế độ Test',
          })
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: isHidden ? 'Đã bật chế độ Test - Dữ liệu đã được backup' : 'Đã tắt chế độ Test'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'stop_test_mode': {
        // Validate confirmation text
        if (confirmText !== 'tôi đồng ý xoá') {
          return new Response(
            JSON.stringify({ error: 'Văn bản xác nhận không đúng' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Verify password
        if (!password) {
          return new Response(
            JSON.stringify({ error: 'Vui lòng nhập mật khẩu' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Verify password by signing in
        const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
          email: caller.email!,
          password: password,
        })

        if (signInError) {
          return new Response(
            JSON.stringify({ error: 'Mật khẩu không đúng' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Delete data based on deleteMode
        if (deleteMode === 'keep_templates') {
          await deleteKeepTemplates(supabaseAdmin, callerTenantId)
        } else {
          await deleteAllWarehouseData(supabaseAdmin, callerTenantId)
        }
        if (restoreOption === 'restore') {
          // Restore from backup
          // Restore products
          const { data: productsBackup } = await supabaseAdmin
            .from('products_backup')
            .select('data')
            .eq('tenant_id', callerTenantId)
            .order('backup_date', { ascending: false })
            .limit(1)
            .single()

          if (productsBackup?.data) {
            const products = productsBackup.data as any[]
            for (const product of products) {
              await supabaseAdmin.from('products').insert(product)
            }
          }

          // Restore import_receipts
          const { data: importBackup } = await supabaseAdmin
            .from('import_receipts_backup')
            .select('data')
            .eq('tenant_id', callerTenantId)
            .order('backup_date', { ascending: false })
            .limit(1)
            .single()

          if (importBackup?.data) {
            const receipts = importBackup.data as any[]
            for (const receipt of receipts) {
              await supabaseAdmin.from('import_receipts').insert(receipt)
            }
          }

          // Restore export_receipts
          const { data: exportBackup } = await supabaseAdmin
            .from('export_receipts_backup')
            .select('data')
            .eq('tenant_id', callerTenantId)
            .order('backup_date', { ascending: false })
            .limit(1)
            .single()

          if (exportBackup?.data) {
            const receipts = exportBackup.data as any[]
            for (const receipt of receipts) {
              await supabaseAdmin.from('export_receipts').insert(receipt)
            }
          }

          // Restore cash_book
          const { data: cashBackup } = await supabaseAdmin
            .from('cash_book_backup')
            .select('data')
            .eq('tenant_id', callerTenantId)
            .order('backup_date', { ascending: false })
            .limit(1)
            .single()

          if (cashBackup?.data) {
            const entries = cashBackup.data as any[]
            for (const entry of entries) {
              await supabaseAdmin.from('cash_book').insert(entry)
            }
          }

          // Log action
          await supabaseAdmin.from('audit_logs').insert({
            tenant_id: callerTenantId,
            user_id: caller.id,
            action_type: 'RESTORE_DATA_FROM_BACKUP',
            table_name: 'ALL',
            description: 'Ngưng Test - Khôi phục dữ liệu gốc từ backup',
          })
        } else {
          // Log deletion action
          await supabaseAdmin.from('audit_logs').insert({
            tenant_id: callerTenantId,
            user_id: caller.id,
            action_type: deleteMode === 'keep_templates' ? 'DELETE_KEEP_TEMPLATES' : 'DELETE_ALL_WAREHOUSE_DATA',
            table_name: 'ALL',
            description: deleteMode === 'keep_templates' 
              ? 'Xoá lịch sử, giữ sản phẩm mẫu (tồn kho = 0)' 
              : 'Ngưng Test - Xoá toàn bộ dữ liệu kho',
          })
        }

        // Clear backup data
        await supabaseAdmin.from('products_backup').delete().eq('tenant_id', callerTenantId)
        await supabaseAdmin.from('import_receipts_backup').delete().eq('tenant_id', callerTenantId)
        await supabaseAdmin.from('export_receipts_backup').delete().eq('tenant_id', callerTenantId)
        await supabaseAdmin.from('cash_book_backup').delete().eq('tenant_id', callerTenantId)

        // Update tenant status
        await supabaseAdmin
          .from('tenants')
          .update({ is_data_hidden: false, has_data_backup: false })
          .eq('id', callerTenantId)

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: restoreOption === 'restore' 
              ? 'Đã khôi phục dữ liệu gốc thành công' 
              : 'Đã xoá toàn bộ dữ liệu kho thành công'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Keep old action for backward compatibility
      case 'delete_all_data': {
        // Validate confirmation text
        if (confirmText !== 'tôi đồng ý xoá') {
          return new Response(
            JSON.stringify({ error: 'Văn bản xác nhận không đúng' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Verify password
        if (!password) {
          return new Response(
            JSON.stringify({ error: 'Vui lòng nhập mật khẩu' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Verify password by signing in
        const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
          email: caller.email!,
          password: password,
        })

        if (signInError) {
          return new Response(
            JSON.stringify({ error: 'Mật khẩu không đúng' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        await deleteAllWarehouseData(supabaseAdmin, callerTenantId)

        // Log the deletion action
        await supabaseAdmin.from('audit_logs').insert({
          tenant_id: callerTenantId,
          user_id: caller.id,
          action_type: 'DELETE_ALL_DATA',
          table_name: 'ALL',
          description: 'Xoá toàn bộ dữ liệu kho (Sản phẩm, Phiếu nhập/xuất, Sổ quỹ, Công nợ, Kiểm kho)',
        })

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Đã xoá toàn bộ dữ liệu kho thành công'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Hành động không hợp lệ' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Lỗi hệ thống: ' + (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function isMissingTableError(error: any) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('could not find the table') || message.includes('relation') && message.includes('does not exist')
}

async function assertMutation(label: string, operation: Promise<any>) {
  const { error } = await operation
  if (!error) return
  console.error(`[tenant-data-management] ${label} failed:`, error)
  throw new Error(`${label}: ${error.message}`)
}

async function assertOptionalMutation(label: string, operation: Promise<any>) {
  const { error } = await operation
  if (!error) return
  if (isMissingTableError(error)) {
    console.warn(`[tenant-data-management] ${label} skipped:`, error.message)
    return
  }
  console.error(`[tenant-data-management] ${label} failed:`, error)
  throw new Error(`${label}: ${error.message}`)
}

async function fetchIdsByTenant(supabaseAdmin: any, table: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('id')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error(`[tenant-data-management] fetch ${table} failed:`, error)
    throw new Error(`Không thể tải danh sách ${table}: ${error.message}`)
  }

  return (data || []).map((row: any) => row.id)
}

async function deleteByIdsInBatches(
  supabaseAdmin: any,
  table: string,
  column: string,
  ids: string[],
  label: string,
  optional = false,
  batchSize = 200,
) {
  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize)
    const operation = supabaseAdmin.from(table).delete().in(column, batch)
    if (optional) {
      await assertOptionalMutation(label, operation)
    } else {
      await assertMutation(label, operation)
    }
  }
}

async function deleteAllWarehouseData(supabaseAdmin: any, tenantId: string) {
  const [productIds, customerIds, supplierIds, exportReceiptIds, importReceiptIds, stockCountIds, einvoiceIds, landingOrderIds, stockTransferIds] = await Promise.all([
    fetchIdsByTenant(supabaseAdmin, 'products', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'customers', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'suppliers', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'export_receipts', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'import_receipts', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'stock_counts', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'einvoices', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'landing_orders', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'stock_transfer_requests', tenantId),
  ])

  if (productIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'imei_histories', 'product_id', productIds, 'Xoá lịch sử IMEI')
    await deleteByIdsInBatches(supabaseAdmin, 'product_imports', 'product_id', productIds, 'Xoá lịch sử nhập sản phẩm')
  }

  if (stockCountIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'stock_count_items', 'stock_count_id', stockCountIds, 'Xoá chi tiết kiểm kho', true)
  }
  await assertOptionalMutation('Xoá phiếu kiểm kho', supabaseAdmin.from('stock_counts').delete().eq('tenant_id', tenantId))

  if (einvoiceIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'einvoice_items', 'einvoice_id', einvoiceIds, 'Xoá chi tiết hoá đơn điện tử', true)
  }
  await assertOptionalMutation('Xoá log hoá đơn điện tử', supabaseAdmin.from('einvoice_logs').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá hoá đơn điện tử', supabaseAdmin.from('einvoices').delete().eq('tenant_id', tenantId))

  await assertMutation('Xoá phiếu trả hàng bán', supabaseAdmin.from('export_returns').delete().eq('tenant_id', tenantId))
  await assertMutation('Xoá phiếu trả hàng nhập', supabaseAdmin.from('import_returns').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá thanh toán trả hàng', supabaseAdmin.from('return_payments').delete().eq('tenant_id', tenantId))

  if (exportReceiptIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_items', 'receipt_id', exportReceiptIds, 'Xoá chi tiết phiếu xuất')
    await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_payments', 'receipt_id', exportReceiptIds, 'Xoá thanh toán phiếu xuất')
  }
  await assertMutation('Xoá phiếu xuất', supabaseAdmin.from('export_receipts').delete().eq('tenant_id', tenantId))

  if (importReceiptIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập', true)
    await deleteByIdsInBatches(supabaseAdmin, 'import_receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập cũ', true)
  }
  await assertMutation('Xoá phiếu nhập', supabaseAdmin.from('import_receipts').delete().eq('tenant_id', tenantId))

  if (stockTransferIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'transfer_request_id', stockTransferIds, 'Xoá chi tiết chuyển kho')
  }
  if (productIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'product_id', productIds, 'Xoá liên kết chuyển kho theo sản phẩm')
  }
  if (supplierIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'supplier_id', supplierIds, 'Xoá liên kết chuyển kho theo nhà cung cấp', true)
  }
  await assertOptionalMutation('Xoá phiếu chuyển kho', supabaseAdmin.from('stock_transfer_requests').delete().eq('tenant_id', tenantId))

  await assertMutation('Xoá sản phẩm', supabaseAdmin.from('products').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá nhóm sản phẩm', supabaseAdmin.from('product_groups').delete().eq('tenant_id', tenantId))

  await assertMutation('Xoá sổ quỹ', supabaseAdmin.from('cash_book').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá số dư đầu kỳ', supabaseAdmin.from('cash_book_opening_balances').delete().eq('tenant_id', tenantId))

  await assertMutation('Xoá thanh toán công nợ', supabaseAdmin.from('debt_payments').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá bù trừ công nợ', supabaseAdmin.from('debt_offsets').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá gán nhãn công nợ', supabaseAdmin.from('debt_tag_assignments').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá nhãn công nợ', supabaseAdmin.from('debt_tags').delete().eq('tenant_id', tenantId))

  if (customerIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'customer_tag_assignments', 'customer_id', customerIds, 'Xoá gán tag khách hàng', true)
    await deleteByIdsInBatches(supabaseAdmin, 'customer_contact_channels', 'customer_id', customerIds, 'Xoá kênh liên hệ khách hàng', true)
    await deleteByIdsInBatches(supabaseAdmin, 'point_transactions', 'customer_id', customerIds, 'Xoá lịch sử điểm', true)
    await deleteByIdsInBatches(supabaseAdmin, 'email_automation_logs', 'customer_id', customerIds, 'Xoá log email khách hàng', true)
  }
  await assertOptionalMutation('Xoá log chăm sóc khách hàng', supabaseAdmin.from('customer_care_logs').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá nhắc lịch chăm sóc', supabaseAdmin.from('care_reminders').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá lịch chăm sóc', supabaseAdmin.from('customer_care_schedules').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá voucher khách hàng', supabaseAdmin.from('customer_vouchers').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá tag khách hàng', supabaseAdmin.from('customer_tags').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá nguồn khách hàng', supabaseAdmin.from('customer_sources').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá thông báo CRM', supabaseAdmin.from('crm_notifications').delete().eq('tenant_id', tenantId))
  await assertMutation('Xoá khách hàng', supabaseAdmin.from('customers').delete().eq('tenant_id', tenantId))

  await assertOptionalMutation('Xoá nhà cung cấp', supabaseAdmin.from('suppliers').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá danh mục', supabaseAdmin.from('categories').delete().eq('tenant_id', tenantId))

  await assertOptionalMutation('Xoá thống kê ngày', supabaseAdmin.from('daily_stats').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá snapshot giá trị kho', supabaseAdmin.from('warehouse_value_snapshots').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá snapshot hiệu suất nhân viên', supabaseAdmin.from('staff_performance_snapshots').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá đánh giá nhân viên', supabaseAdmin.from('staff_reviews').delete().eq('tenant_id', tenantId))

  await assertOptionalMutation('Xoá mẫu voucher', supabaseAdmin.from('voucher_templates').delete().eq('tenant_id', tenantId))

  if (landingOrderIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'shop_ctv_orders', 'landing_order_id', landingOrderIds, 'Xoá đơn cộng tác viên', true)
  }
  await assertOptionalMutation('Xoá log email đơn landing', supabaseAdmin.from('landing_order_email_logs').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá đơn landing', supabaseAdmin.from('landing_orders').delete().eq('tenant_id', tenantId))

  await assertMutation('Xoá nhật ký hệ thống', supabaseAdmin.from('audit_logs').delete().eq('tenant_id', tenantId))
}

async function deleteKeepTemplates(supabaseAdmin: any, tenantId: string) {
  // This mode: delete all transaction history but keep products as templates (qty=0)
  
  // Get all product IDs for this tenant
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
  
  const productIds = products?.map((p: any) => p.id) || []

  // 1. Delete IMEI histories
  if (productIds.length > 0) {
    await supabaseAdmin
      .from('imei_histories')
      .delete()
      .in('product_id', productIds)
  }

  // 2. Delete export returns
  await supabaseAdmin.from('export_returns').delete().eq('tenant_id', tenantId)

  // 3. Delete import returns
  await supabaseAdmin.from('import_returns').delete().eq('tenant_id', tenantId)

  // 4. Delete export receipt items & payments
  const { data: exportReceipts } = await supabaseAdmin
    .from('export_receipts')
    .select('id')
    .eq('tenant_id', tenantId)
  
  const exportReceiptIds = exportReceipts?.map((r: any) => r.id) || []
  
  if (exportReceiptIds.length > 0) {
    await supabaseAdmin.from('export_receipt_items').delete().in('receipt_id', exportReceiptIds)
    await supabaseAdmin.from('export_receipt_payments').delete().in('receipt_id', exportReceiptIds)
  }

  // 5. Delete export receipts
  await supabaseAdmin.from('export_receipts').delete().eq('tenant_id', tenantId)

  // 6. Delete import receipt payments
  const { data: importReceipts } = await supabaseAdmin
    .from('import_receipts')
    .select('id')
    .eq('tenant_id', tenantId)
  
  const importReceiptIds = importReceipts?.map((r: any) => r.id) || []
  
  if (importReceiptIds.length > 0) {
    try {
      await supabaseAdmin.from('import_receipt_payments').delete().in('receipt_id', importReceiptIds)
    } catch { /* Table might not exist */ }
  }

  // 7. Delete import receipts
  await supabaseAdmin.from('import_receipts').delete().eq('tenant_id', tenantId)

  // 8. Reset products to template (qty=0, status=in_stock, clear IMEI)
  // Delete IMEI products (they are unique per unit, no point keeping as template)
  await supabaseAdmin
    .from('products')
    .delete()
    .eq('tenant_id', tenantId)
    .not('imei', 'is', null)

  // Reset non-IMEI products: quantity=0
  await supabaseAdmin
    .from('products')
    .update({ 
      quantity: 0,
      status: 'in_stock',
    })
    .eq('tenant_id', tenantId)

  // 9. Delete cash book entries
  await supabaseAdmin.from('cash_book').delete().eq('tenant_id', tenantId)

  // 10. Delete debt payments
  await supabaseAdmin.from('debt_payments').delete().eq('tenant_id', tenantId)

  // 11. Delete stock counts
  const { data: stockCounts } = await supabaseAdmin
    .from('stock_counts')
    .select('id')
    .eq('tenant_id', tenantId)
  
  const stockCountIds = stockCounts?.map((s: any) => s.id) || []
  
  if (stockCountIds.length > 0) {
    try {
      await supabaseAdmin.from('stock_count_items').delete().in('stock_count_id', stockCountIds)
    } catch { /* Ignore */ }
  }

  try {
    await supabaseAdmin.from('stock_counts').delete().eq('tenant_id', tenantId)
  } catch { /* Ignore */ }

  // 12. Delete audit logs
  await supabaseAdmin.from('audit_logs').delete().eq('tenant_id', tenantId)

  // 13. Reset customer data (keep customers)
  await supabaseAdmin
    .from('customers')
    .update({
      total_spent: 0,
      current_points: 0,
      pending_points: 0,
      total_points_earned: 0,
      total_points_used: 0,
      last_purchase_date: null,
    })
    .eq('tenant_id', tenantId)
}
