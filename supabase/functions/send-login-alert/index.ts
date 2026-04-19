import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { resolveSmtpForTenant, createSmtpTransporter } from '../_shared/smtp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Payload {
  user_id?: string
  email?: string
  user_agent?: string
  ip?: string
  tenant_id?: string | null
}

async function lookupGeo(ip: string): Promise<{ city?: string; region?: string; country?: string; isp?: string }> {
  try {
    if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return {}
    }
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp&lang=vi`)
    const data = await res.json()
    if (data.status === 'success') {
      return { city: data.city, region: data.regionName, country: data.country, isp: data.isp }
    }
  } catch (err) {
    console.warn('Geo lookup failed:', err)
  }
  return {}
}

function parseUA(ua: string): string {
  if (!ua) return 'Không xác định'
  const browser = /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : /Edge/i.test(ua) ? 'Edge' : 'Trình duyệt khác'
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac OS|Macintosh/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iOS/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : 'Hệ điều hành khác'
  return `${browser} trên ${os}`
}

function buildHtml(opts: {
  email: string
  fullName?: string
  ip: string
  device: string
  location: string
  isp?: string
  time: string
  fromName: string
}) {
  const { email, fullName, ip, device, location, isp, time, fromName } = opts
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#2563eb,#1e40af);padding:24px 32px;color:#fff;">
          <h1 style="margin:0;font-size:20px;">🔐 Cảnh báo đăng nhập mới</h1>
          <p style="margin:4px 0 0;opacity:0.9;font-size:13px;">${fromName}</p>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#1f2937;font-size:14px;line-height:1.6;">
          <p style="margin:0 0 16px;">Xin chào <b>${fullName || email}</b>,</p>
          <p style="margin:0 0 16px;">Chúng tôi vừa ghi nhận một lượt đăng nhập mới vào tài khoản của bạn. Vui lòng kiểm tra thông tin chi tiết bên dưới:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
            <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:120px;">⏰ Thời gian</td><td style="padding:8px 12px;font-weight:600;">${time}</td></tr>
            <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">📍 Vị trí</td><td style="padding:8px 12px;font-weight:600;">${location}</td></tr>
            <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">🌐 Địa chỉ IP</td><td style="padding:8px 12px;font-weight:600;font-family:monospace;">${ip}</td></tr>
            <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">💻 Thiết bị</td><td style="padding:8px 12px;font-weight:600;">${device}</td></tr>
            ${isp ? `<tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">📡 Nhà mạng</td><td style="padding:8px 12px;font-weight:600;">${isp}</td></tr>` : ''}
          </table>
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin:16px 0;">
            <p style="margin:0;font-size:13px;color:#92400e;"><b>Đây là bạn?</b> Bạn có thể bỏ qua email này.</p>
            <p style="margin:8px 0 0;font-size:13px;color:#92400e;"><b>Không phải bạn?</b> Hãy đổi mật khẩu ngay lập tức và liên hệ quản trị viên.</p>
          </div>
          <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Email này được gửi tự động để bảo vệ tài khoản của bạn. Vui lòng không trả lời email.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} ${fromName}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body: Payload = await req.json()
    const ipFromHeader = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown'
    const ip = body.ip || ipFromHeader
    const ua = body.user_agent || req.headers.get('user-agent') || ''

    let email = body.email
    let fullName: string | undefined
    let tenantId: string | null | undefined = body.tenant_id

    if (body.user_id) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(body.user_id)
      if (userData?.user) {
        email = email || userData.user.email
        fullName = (userData.user.user_metadata?.full_name as string)
          || (userData.user.user_metadata?.name as string)
        if (!tenantId) {
          tenantId = (userData.user.user_metadata?.tenant_id as string) || null
        }
      }
    }

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geo = await lookupGeo(ip)
    const location = [geo.city, geo.region, geo.country].filter(Boolean).join(', ') || 'Không xác định'
    const device = parseUA(ua)
    const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })

    const smtp = await resolveSmtpForTenant(supabaseAdmin, tenantId)
    if (!smtp.smtpUser || !smtp.smtpPass) {
      console.warn('No SMTP configured, skipping login alert')
      return new Response(JSON.stringify({ ok: false, reason: 'no_smtp' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const transporter = createSmtpTransporter(smtp)
    const html = buildHtml({ email, fullName, ip, device, location, isp: geo.isp, time, fromName: smtp.fromName })

    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: email,
      subject: `🔐 Cảnh báo đăng nhập mới — ${time}`,
      html,
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-login-alert error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
