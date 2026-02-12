import nodemailer from 'npm:nodemailer@6.9.10'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Verify caller is platform admin
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

    // Check platform admin
    const { data: platformUser } = await supabaseAdmin
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (platformUser?.platform_role !== 'platform_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Only platform admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { emails, subject, htmlContent } = await req.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: 'Thiếu danh sách email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!subject || !htmlContent) {
      return new Response(JSON.stringify({ error: 'Thiếu tiêu đề hoặc nội dung email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')

    if (!smtpUser || !smtpPassword) {
      return new Response(JSON.stringify({ error: 'SMTP not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    // Wrap plain text content in HTML template
    const fullHtml = [
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#f9fafb;border-radius:12px;overflow:hidden">',
        '<div style="background:linear-gradient(135deg,#1a56db,#2563eb);color:#fff;padding:24px;text-align:center">',
          `<h1 style="margin:0;font-size:20px;font-weight:bold">${subject}</h1>`,
        '</div>',
        '<div style="background:#fff;padding:24px">',
          htmlContent,
        '</div>',
        '<div style="background:#f3f4f6;padding:16px 24px;text-align:center">',
          '<p style="margin:0;font-size:12px;color:#9ca3af">© 2025 VKHO – Hệ thống quản lý kho hàng thông minh</p>',
        '</div>',
      '</div>',
    ].join('')

    let sent = 0
    let failed = 0
    const errors: string[] = []
    const failedEmails: string[] = []

    // Create email history record first to get the ID for tracking pixel
    const { data: historyRecord } = await supabaseAdmin.from('email_history').insert({
      subject,
      html_content: htmlContent,
      recipients: emails,
      total_recipients: emails.length,
      success_count: 0,
      fail_count: 0,
      failed_emails: [],
      sent_by: user.id,
    }).select('id').single()

    const historyId = historyRecord?.id
    const trackingBaseUrl = `${supabaseUrl}/functions/v1/track-email-open`

    // Send in parallel batches of 5 for speed
    const BATCH_SIZE = 5
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((email: string) => {
          // Append tracking pixel per recipient
          const trackingPixel = historyId
            ? `<img src="${trackingBaseUrl}?id=${historyId}&e=${encodeURIComponent(email)}" width="1" height="1" style="display:none" alt="" />`
            : ''
          const personalizedHtml = fullHtml + trackingPixel

          return transporter.sendMail({
            from: `"VKHO" <${smtpUser}>`,
            to: email,
            subject,
            html: personalizedHtml,
          }).then(() => ({ email, ok: true }))
           .catch((err: any) => ({ email, ok: false, error: err.message }))
        })
      )
      for (const r of results) {
        const val = r.status === 'fulfilled' ? r.value : { email: 'unknown', ok: false, error: 'Promise rejected' }
        if (val.ok) {
          sent++
        } else {
          failed++
          failedEmails.push(val.email)
          errors.push(`${val.email}: ${val.error}`)
          console.error(`Failed to send to ${val.email}:`, val.error)
        }
      }
    }

    // Update email history with results
    if (historyId) {
      await supabaseAdmin.from('email_history').update({
        success_count: sent,
        fail_count: failed,
        failed_emails: failedEmails,
      }).eq('id', historyId)
    }

    // Log action
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'BULK_EMAIL',
      table_name: 'tenants',
      description: `Gửi email hàng loạt: ${sent} thành công, ${failed} thất bại. Tiêu đề: ${subject}`,
      new_data: { emails, subject, sent, failed },
    })

    return new Response(JSON.stringify({ sent, failed, errors: errors.slice(0, 5) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Bulk email error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
