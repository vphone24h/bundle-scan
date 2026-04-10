import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check tenant admin
    const { data: isAdmin } = await supabaseAdmin.rpc('is_tenant_admin', { _user_id: user.id })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: tenantId } = await supabaseAdmin.rpc('get_user_tenant_id', { _user_id: user.id })
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { ctvIds, subject, htmlContent } = body

    if (!ctvIds || !Array.isArray(ctvIds) || ctvIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Thiếu danh sách CTV' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (ctvIds.length > 200) {
      return new Response(JSON.stringify({ error: 'Tối đa 200 CTV mỗi lần gửi' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!subject || !htmlContent) {
      return new Response(JSON.stringify({ error: 'Thiếu tiêu đề hoặc nội dung email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get tenant SMTP config
    const { data: settings } = await supabaseAdmin
      .from('tenant_landing_settings')
      .select('order_email_sender, order_email_app_password, store_name')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const smtpUser = settings?.order_email_sender
    const smtpPassword = settings?.order_email_app_password
    const storeName = settings?.store_name || 'Cửa hàng'

    if (!smtpUser || !smtpPassword) {
      return new Response(JSON.stringify({ error: 'Chưa cấu hình email gửi. Vui lòng cài đặt SMTP/Gmail trong Cấu hình Website.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get CTV list with emails
    const { data: ctvs, error: ctvError } = await supabaseAdmin
      .from('shop_collaborators')
      .select('id, full_name, email, phone, ctv_code')
      .in('id', ctvIds)
      .eq('tenant_id', tenantId)

    if (ctvError) throw ctvError

    const ctvsWithEmail = (ctvs || []).filter(c => c.email)
    if (ctvsWithEmail.length === 0) {
      return new Response(JSON.stringify({ error: 'Không có CTV nào có email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr><td style="padding:32px 32px 24px">
          BODY_PLACEHOLDER
        </td></tr>
        <tr><td style="background:#1e3a8a;padding:16px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#93c5fd">© ${new Date().getFullYear()} ${storeName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    let sent = 0
    let failed = 0
    const failedEmails: string[] = []

    for (const ctv of ctvsWithEmail) {
      let personalSubject = ''
      try {
        let personalHtml = htmlContent
          .replace(/\{\{ctv_name\}\}/g, ctv.full_name || 'CTV')
          .replace(/\{\{ctv_code\}\}/g, ctv.ctv_code || '')
          .replace(/\{\{ctv_phone\}\}/g, ctv.phone || '')
          .replace(/\{\{store_name\}\}/g, storeName)

        personalSubject = subject
          .replace(/\{\{ctv_name\}\}/g, ctv.full_name || 'CTV')
          .replace(/\{\{ctv_code\}\}/g, ctv.ctv_code || '')
          .replace(/\{\{store_name\}\}/g, storeName)

        const emailBody = fullHtml.replace('BODY_PLACEHOLDER', personalHtml)

        await transporter.sendMail({
          from: `"${storeName}" <${smtpUser}>`,
          to: ctv.email,
          subject: personalSubject,
          html: emailBody,
        })
        sent++

        // Log to email_automation_logs
        await supabaseAdmin.from('email_automation_logs').insert({
          tenant_id: tenantId,
          automation_id: null,
          customer_email: ctv.email,
          customer_name: ctv.full_name || null,
          customer_id: null,
          subject: personalSubject,
          status: 'sent',
          sent_at: new Date().toISOString(),
          source: 'ctv_bulk',
          body_html: emailBody,
        })
      } catch (e) {
        console.error(`Failed to send to ${ctv.email}:`, e)
        failed++
        failedEmails.push(ctv.email!)

        await supabaseAdmin.from('email_automation_logs').insert({
          tenant_id: tenantId,
          automation_id: null,
          customer_email: ctv.email,
          customer_name: ctv.full_name || null,
          customer_id: null,
          subject: personalSubject || subject,
          status: 'failed',
          source: 'ctv_bulk',
          error_message: (e as Error).message || 'Unknown error',
        })
      }

      if (sent % 10 === 0) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    return new Response(JSON.stringify({ 
      sent, failed, 
      total: ctvsWithEmail.length,
      skipped: ctvIds.length - ctvsWithEmail.length,
      failedEmails,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('send-ctv-email error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
