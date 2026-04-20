import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function normalizePhoneTo0(phone: string): string {
  let p = (phone || '').replace(/\s/g, '').replace(/[^0-9]/g, '')
  if (p.startsWith('84')) p = '0' + p.substring(2)
  return p
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: isAdmin } = await supabaseAdmin.rpc('is_tenant_admin', { _user_id: user.id })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: tenantId } = await supabaseAdmin.rpc('get_user_tenant_id', { _user_id: user.id })
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { customerIds, message } = body

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Thiếu danh sách khách hàng' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (customerIds.length > 200) {
      return new Response(JSON.stringify({ error: 'Tối đa 200 khách hàng mỗi lần gửi' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Thiếu nội dung tin nhắn' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get Zalo OA settings
    const { data: settings } = await supabaseAdmin
      .from('tenant_landing_settings')
      .select('zalo_access_token, zalo_oa_id, zalo_enabled, store_name, store_phone')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!settings?.zalo_access_token || !settings?.zalo_oa_id) {
      return new Response(JSON.stringify({ error: 'Chưa cấu hình Zalo OA. Vào Nhắn tin tự động → Cấu hình.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const storeName = settings.store_name || 'Cửa hàng'
    const accessToken = settings.zalo_access_token

    // Get customers with phones
    const { data: customers, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, name, phone')
      .in('id', customerIds)
      .eq('tenant_id', tenantId)

    if (custError) throw custError

    const customersWithPhone = (customers || []).filter(c => c.phone)

    let sent = 0
    let failed = 0
    const failedPhones: string[] = []

    for (const customer of customersWithPhone) {
      const phone0 = normalizePhoneTo0(customer.phone!)

      // Look up Zalo follower user_id by phone
      const { data: follower } = await supabaseAdmin
        .from('zalo_oa_followers')
        .select('zalo_user_id')
        .eq('tenant_id', tenantId)
        .eq('phone', phone0)
        .maybeSingle()

      if (!follower?.zalo_user_id) {
        failed++
        failedPhones.push(customer.phone!)
        await supabaseAdmin.from('zalo_message_logs').insert({
          tenant_id: tenantId,
          customer_phone: customer.phone,
          customer_name: customer.name || '',
          message_type: 'care_bulk',
          message_content: message,
          status: 'failed',
          error_message: 'Khách chưa follow OA',
          sent_at: new Date().toISOString(),
        }).catch(() => {})
        continue
      }

      const personalMessage = message
        .replace(/\{\{customer_name\}\}/g, customer.name || 'Quý khách')
        .replace(/\{\{phone\}\}/g, customer.phone || '')
        .replace(/\{\{store_name\}\}/g, storeName)

      try {
        const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'access_token': accessToken },
          body: JSON.stringify({
            recipient: { user_id: follower.zalo_user_id },
            message: { text: personalMessage },
          }),
        })
        const result = await res.json()
        const ok = result?.error === 0
        if (ok) sent++
        else { failed++; failedPhones.push(customer.phone!) }

        await supabaseAdmin.from('zalo_message_logs').insert({
          tenant_id: tenantId,
          customer_phone: customer.phone,
          customer_name: customer.name || '',
          message_type: 'care_bulk',
          message_content: personalMessage,
          status: ok ? 'sent' : 'failed',
          error_message: ok ? null : JSON.stringify(result),
          sent_at: new Date().toISOString(),
        }).catch(() => {})
      } catch (e: any) {
        failed++
        failedPhones.push(customer.phone!)
        await supabaseAdmin.from('zalo_message_logs').insert({
          tenant_id: tenantId,
          customer_phone: customer.phone,
          customer_name: customer.name || '',
          message_type: 'care_bulk',
          message_content: personalMessage,
          status: 'failed',
          error_message: e.message || 'Unknown',
          sent_at: new Date().toISOString(),
        }).catch(() => {})
      }

      if ((sent + failed) % 10 === 0) await new Promise(r => setTimeout(r, 1000))
    }

    return new Response(JSON.stringify({
      sent, failed,
      total: customersWithPhone.length,
      skipped: customerIds.length - customersWithPhone.length,
      failedPhones,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('send-care-zalo error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
