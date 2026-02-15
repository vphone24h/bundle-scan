import nodemailer from 'npm:nodemailer@6.9.10'
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
    // Verify auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check platform admin
    const { data: platformUser } = await supabaseAdmin
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', user.id)
      .eq('platform_role', 'platform_admin')
      .maybeSingle()

    if (!platformUser) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { toEmail, articleTitle, articleSummary, articleUrl } = await req.json()

    if (!toEmail || !articleTitle) {
      return new Response(JSON.stringify({ error: 'Missing toEmail or articleTitle' }), {
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

    const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1a56db,#2563eb);color:#fff;padding:24px;text-align:center">
        <h1 style="margin:0;font-size:20px">📖 Hướng dẫn từ VKHO</h1>
      </div>
      <div style="background:#fff;padding:24px">
        <p style="font-size:16px;color:#374151;margin:0 0 16px">Xin chào,</p>
        <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px">Chúng tôi gửi đến bạn bài hướng dẫn:</p>
        <div style="background:#eff6ff;border-left:4px solid #1a56db;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 20px">
          <h2 style="margin:0 0 8px;font-size:18px;color:#1e40af">${articleTitle}</h2>
          ${articleSummary ? `<p style="margin:0;font-size:14px;color:#374151">${articleSummary}</p>` : ''}
        </div>
        <div style="text-align:center;margin:20px 0">
          <a href="${articleUrl}" style="display:inline-block;background:#1a56db;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Xem hướng dẫn →</a>
        </div>
        <p style="font-size:14px;color:#6b7280;margin:20px 0 0">Mọi thắc mắc vui lòng liên hệ: <strong>📞 0396-793-883 (Zalo)</strong></p>
      </div>
      <div style="background:#f3f4f6;padding:16px 24px;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af">© 2026 VKHO – Hệ thống quản lý kho hàng thông minh</p>
      </div>
    </div>`

    await transporter.sendMail({
      from: `"VKHO" <${smtpUser}>`,
      to: toEmail,
      subject: `📖 Hướng dẫn: ${articleTitle}`,
      html: htmlContent,
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
