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

    const { paymentId, action, rejectedReason, bonusDays } = await req.json()

    if (!paymentId || !action) {
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get payment request
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payment_requests')
      .select(`
        *,
        tenants (*),
        subscription_plans (*)
      `)
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy yêu cầu thanh toán' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (payment.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Yêu cầu thanh toán đã được xử lý' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'approve') {
      const plan = payment.subscription_plans
      const tenant = payment.tenants
      
      // Calculate new subscription end date
      let newEndDate: Date
      const now = new Date()
      
      if (plan.plan_type === 'lifetime') {
        // Set to 100 years from now for lifetime
        newEndDate = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
      } else {
        // Calculate based on duration_days
        const currentEndDate = tenant.subscription_end_date 
          ? new Date(tenant.subscription_end_date)
          : now
        
        const baseDate = currentEndDate > now ? currentEndDate : now
        const daysToAdd = (plan.duration_days || 30) + (bonusDays || 0)
        newEndDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
      }

      // Update payment request
      await supabaseAdmin
        .from('payment_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: caller.id,
        })
        .eq('id', paymentId)

      // Update tenant
      await supabaseAdmin
        .from('tenants')
        .update({
          status: 'active',
          subscription_plan: plan.plan_type,
          subscription_start_date: now.toISOString(),
          subscription_end_date: newEndDate.toISOString(),
          max_branches: plan.max_branches,
          max_users: plan.max_users,
          locked_at: null,
          locked_reason: null,
        })
        .eq('id', tenant.id)

      // Create subscription history
      await supabaseAdmin
        .from('subscription_history')
        .insert({
          tenant_id: tenant.id,
          plan_id: plan.id,
          payment_request_id: paymentId,
          action: 'subscription_start',
          old_status: tenant.status,
          new_status: 'active',
          old_end_date: tenant.subscription_end_date,
          new_end_date: newEndDate.toISOString(),
          days_added: plan.duration_days,
          performed_by: caller.id,
          note: `Kích hoạt gói ${plan.name}${bonusDays ? ` + ${bonusDays} ngày bonus` : ''}`,
        })

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Đã duyệt thanh toán thành công',
          newEndDate: newEndDate.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'reject') {
      await supabaseAdmin
        .from('payment_requests')
        .update({
          status: 'rejected',
          rejected_reason: rejectedReason || 'Không đạt yêu cầu',
        })
        .eq('id', paymentId)

      return new Response(
        JSON.stringify({ success: true, message: 'Đã từ chối yêu cầu thanh toán' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Hành động không hợp lệ' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Lỗi hệ thống' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})