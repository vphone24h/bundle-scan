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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { paymentId } = await req.json().catch(() => ({}))
    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: 'Thiếu paymentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get payment request
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payment_requests')
      .select('id, tenant_id, status')
      .eq('id', paymentId)
      .maybeSingle()

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy yêu cầu thanh toán' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (payment.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Chỉ có thể hủy yêu cầu đang chờ duyệt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Verify caller belongs to that tenant
    const { data: belongs, error: belongsError } = await supabaseAdmin
      .rpc('belongs_to_tenant', { _user_id: caller.id, _tenant_id: payment.tenant_id })

    if (belongsError) {
      return new Response(
        JSON.stringify({ error: 'Không thể kiểm tra quyền truy cập' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!belongs) {
      return new Response(
        JSON.stringify({ error: 'Không có quyền hủy yêu cầu này' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('payment_requests')
      .update({ status: 'cancelled' })
      .eq('id', paymentId)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Không thể hủy yêu cầu' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Lỗi hệ thống' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
