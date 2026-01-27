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
    const { action, tenantId, password, confirmText, restoreOption } = body

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

        // Delete current data first (for both options)
        await deleteAllWarehouseData(supabaseAdmin, callerTenantId)

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
            action_type: 'DELETE_ALL_WAREHOUSE_DATA',
            table_name: 'ALL',
            description: 'Ngưng Test - Xoá toàn bộ dữ liệu kho',
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

async function deleteAllWarehouseData(supabaseAdmin: any, tenantId: string) {
  // Get all product IDs for this tenant first
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
  
  const productIds = products?.map((p: any) => p.id) || []

  // Delete data in order (respect foreign keys)
  // 1. Delete IMEI histories
  if (productIds.length > 0) {
    await supabaseAdmin
      .from('imei_histories')
      .delete()
      .in('product_id', productIds)
  }

  // 2. Delete export returns
  await supabaseAdmin
    .from('export_returns')
    .delete()
    .eq('tenant_id', tenantId)

  // 3. Delete import returns
  await supabaseAdmin
    .from('import_returns')
    .delete()
    .eq('tenant_id', tenantId)

  // 4. Delete export receipt items & payments
  const { data: exportReceipts } = await supabaseAdmin
    .from('export_receipts')
    .select('id')
    .eq('tenant_id', tenantId)
  
  const exportReceiptIds = exportReceipts?.map((r: any) => r.id) || []
  
  if (exportReceiptIds.length > 0) {
    await supabaseAdmin
      .from('export_receipt_items')
      .delete()
      .in('receipt_id', exportReceiptIds)

    await supabaseAdmin
      .from('export_receipt_payments')
      .delete()
      .in('receipt_id', exportReceiptIds)
  }

  // 5. Delete export receipts
  await supabaseAdmin
    .from('export_receipts')
    .delete()
    .eq('tenant_id', tenantId)

  // 6. Delete import receipt payments (if exists)
  const { data: importReceipts } = await supabaseAdmin
    .from('import_receipts')
    .select('id')
    .eq('tenant_id', tenantId)
  
  const importReceiptIds = importReceipts?.map((r: any) => r.id) || []
  
  if (importReceiptIds.length > 0) {
    try {
      await supabaseAdmin
        .from('import_receipt_payments')
        .delete()
        .in('receipt_id', importReceiptIds)
    } catch {
      // Table might not exist
    }
  }

  // 7. Delete import receipts
  await supabaseAdmin
    .from('import_receipts')
    .delete()
    .eq('tenant_id', tenantId)

  // 8. Delete products
  await supabaseAdmin
    .from('products')
    .delete()
    .eq('tenant_id', tenantId)

  // 9. Delete cash book entries
  await supabaseAdmin
    .from('cash_book')
    .delete()
    .eq('tenant_id', tenantId)

  // 10. Delete debt payments
  await supabaseAdmin
    .from('debt_payments')
    .delete()
    .eq('tenant_id', tenantId)

  // 11. Delete stock counts
  const { data: stockCounts } = await supabaseAdmin
    .from('stock_counts')
    .select('id')
    .eq('tenant_id', tenantId)
  
  const stockCountIds = stockCounts?.map((s: any) => s.id) || []
  
  if (stockCountIds.length > 0) {
    try {
      await supabaseAdmin
        .from('stock_count_items')
        .delete()
        .in('stock_count_id', stockCountIds)
    } catch {
      // Ignore if table doesn't exist
    }
  }

  try {
    await supabaseAdmin
      .from('stock_counts')
      .delete()
      .eq('tenant_id', tenantId)
  } catch {
    // Ignore if table doesn't exist
  }

  // 12. Delete audit logs
  await supabaseAdmin
    .from('audit_logs')
    .delete()
    .eq('tenant_id', tenantId)

  // 13. Reset customer data (but keep customers)
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
