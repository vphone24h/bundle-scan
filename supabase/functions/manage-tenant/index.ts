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

    // Check if caller is platform admin
    const { data: platformUser } = await supabaseAdmin
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', caller.id)
      .single()

    if (!platformUser || platformUser.platform_role !== 'platform_admin') {
      return new Response(
        JSON.stringify({ error: 'Chỉ Admin nền tảng mới có quyền thực hiện' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, tenantId, reason, days, note } = await req.json()

    if (!tenantId || !action) {
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy doanh nghiệp' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      case 'lock': {
        await supabaseAdmin
          .from('tenants')
          .update({
            status: 'locked',
            locked_at: new Date().toISOString(),
            locked_reason: reason || 'Bị khóa bởi quản trị viên',
          })
          .eq('id', tenantId)

        await supabaseAdmin
          .from('subscription_history')
          .insert({
            tenant_id: tenantId,
            action: 'locked',
            old_status: tenant.status,
            new_status: 'locked',
            performed_by: caller.id,
            note: reason || 'Khóa tài khoản',
          })

        return new Response(
          JSON.stringify({ success: true, message: 'Đã khóa doanh nghiệp' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'unlock': {
        await supabaseAdmin
          .from('tenants')
          .update({
            status: tenant.subscription_end_date && new Date(tenant.subscription_end_date) > new Date() 
              ? 'active' 
              : (tenant.trial_end_date && new Date(tenant.trial_end_date) > new Date() ? 'trial' : 'expired'),
            locked_at: null,
            locked_reason: null,
          })
          .eq('id', tenantId)

        await supabaseAdmin
          .from('subscription_history')
          .insert({
            tenant_id: tenantId,
            action: 'unlocked',
            old_status: 'locked',
            new_status: 'active',
            performed_by: caller.id,
            note: note || 'Mở khóa tài khoản',
          })

        return new Response(
          JSON.stringify({ success: true, message: 'Đã mở khóa doanh nghiệp' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'extend': {
        if (!days || days < 1) {
          return new Response(
            JSON.stringify({ error: 'Số ngày gia hạn không hợp lệ' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const now = new Date()
        const currentEndDate = tenant.subscription_end_date 
          ? new Date(tenant.subscription_end_date)
          : (tenant.trial_end_date ? new Date(tenant.trial_end_date) : now)
        
        const baseDate = currentEndDate > now ? currentEndDate : now
        const newEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)

        const updateData: Record<string, unknown> = {}
        
        if (tenant.subscription_plan) {
          updateData.subscription_end_date = newEndDate.toISOString()
        } else {
          updateData.trial_end_date = newEndDate.toISOString()
        }

        // If currently expired, reactivate
        if (tenant.status === 'expired') {
          updateData.status = tenant.subscription_plan ? 'active' : 'trial'
        }

        await supabaseAdmin
          .from('tenants')
          .update(updateData)
          .eq('id', tenantId)

        await supabaseAdmin
          .from('subscription_history')
          .insert({
            tenant_id: tenantId,
            action: 'extension',
            old_status: tenant.status,
            new_status: updateData.status || tenant.status,
            old_end_date: currentEndDate.toISOString(),
            new_end_date: newEndDate.toISOString(),
            days_added: days,
            performed_by: caller.id,
            note: note || `Gia hạn ${days} ngày`,
          })

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Đã gia hạn ${days} ngày`,
            newEndDate: newEndDate.toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'set_expired': {
        await supabaseAdmin
          .from('tenants')
          .update({ status: 'expired' })
          .eq('id', tenantId)

        await supabaseAdmin
          .from('subscription_history')
          .insert({
            tenant_id: tenantId,
            action: 'expired',
            old_status: tenant.status,
            new_status: 'expired',
            performed_by: caller.id,
            note: note || 'Hết hạn sử dụng',
          })

        return new Response(
          JSON.stringify({ success: true, message: 'Đã đặt trạng thái hết hạn' }),
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
      JSON.stringify({ error: 'Lỗi hệ thống' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})