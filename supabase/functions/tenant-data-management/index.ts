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
    const { action, tenantId, password, confirmText } = body

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

        // Update tenant data visibility
        const { error: updateError } = await supabaseAdmin
          .from('tenants')
          .update({ is_data_hidden: isHidden })
          .eq('id', callerTenantId)

        if (updateError) {
          console.error('Update error:', updateError)
          return new Response(
            JSON.stringify({ error: 'Không thể cập nhật trạng thái' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Log action
        await supabaseAdmin.from('audit_logs').insert({
          tenant_id: callerTenantId,
          user_id: caller.id,
          action_type: isHidden ? 'ENABLE_TEST_MODE' : 'DISABLE_TEST_MODE',
          table_name: 'tenants',
          description: isHidden ? 'Bật chế độ test (ẩn dữ liệu)' : 'Tắt chế độ test (hiện dữ liệu)',
        })

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: isHidden ? 'Đã bật chế độ test' : 'Đã tắt chế độ test'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

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

        // Get all product IDs for this tenant first
        const { data: products } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('tenant_id', callerTenantId)
        
        const productIds = products?.map(p => p.id) || []

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
          .eq('tenant_id', callerTenantId)

        // 3. Delete import returns
        await supabaseAdmin
          .from('import_returns')
          .delete()
          .eq('tenant_id', callerTenantId)

        // 4. Delete export receipt items & payments
        const { data: exportReceipts } = await supabaseAdmin
          .from('export_receipts')
          .select('id')
          .eq('tenant_id', callerTenantId)
        
        const exportReceiptIds = exportReceipts?.map(r => r.id) || []
        
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
          .eq('tenant_id', callerTenantId)

        // 6. Delete import receipt payments (if exists)
        const { data: importReceipts } = await supabaseAdmin
          .from('import_receipts')
          .select('id')
          .eq('tenant_id', callerTenantId)
        
        const importReceiptIds = importReceipts?.map(r => r.id) || []
        
        if (importReceiptIds.length > 0) {
          // Delete payment records if table exists - wrap in try/catch
          try {
            await supabaseAdmin
              .from('import_receipt_payments')
              .delete()
              .in('receipt_id', importReceiptIds)
          } catch {
            // Table might not exist, ignore error
          }
        }

        // 7. Delete import receipts
        await supabaseAdmin
          .from('import_receipts')
          .delete()
          .eq('tenant_id', callerTenantId)

        // 8. Delete products
        await supabaseAdmin
          .from('products')
          .delete()
          .eq('tenant_id', callerTenantId)

        // 9. Delete cash book entries
        await supabaseAdmin
          .from('cash_book')
          .delete()
          .eq('tenant_id', callerTenantId)

        // 10. Delete debt payments
        await supabaseAdmin
          .from('debt_payments')
          .delete()
          .eq('tenant_id', callerTenantId)

        // 11. Delete stock counts
        const { data: stockCounts } = await supabaseAdmin
          .from('stock_counts')
          .select('id')
          .eq('tenant_id', callerTenantId)
        
        const stockCountIds = stockCounts?.map(s => s.id) || []
        
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
            .eq('tenant_id', callerTenantId)
        } catch {
          // Ignore if table doesn't exist
        }

        // 12. Delete audit logs
        await supabaseAdmin
          .from('audit_logs')
          .delete()
          .eq('tenant_id', callerTenantId)

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
          .eq('tenant_id', callerTenantId)

        // Log the deletion action (create new log after clearing)
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
