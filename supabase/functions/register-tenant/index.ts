import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Input validation helpers
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320
}

function validatePhone(phone: string): boolean {
  return /^[0-9+\-() ]{8,20}$/.test(phone)
}

function sanitizeString(str: string, maxLength: number): string {
  return String(str).trim().slice(0, maxLength)
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('cf-connecting-ip') 
    || req.headers.get('x-real-ip') 
    || '0.0.0.0'
}

async function sendRegistrationNotification(businessName: string, subdomain: string, email: string, adminName: string) {
  try {
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')

    if (!smtpUser || !smtpPassword) {
      console.error('SMTP credentials not configured')
      return
    }

    const now = new Date()
    const dateStr = now.toLocaleDateString('vi-VN', { 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
    })

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })

    const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb;border-radius:8px"><div style="background:#1a56db;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center"><h1 style="margin:0;font-size:20px">🎉 Đăng ký tài khoản mới - VKHO</h1></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px"><p style="font-size:16px;color:#374151;margin-bottom:16px">Có tài khoản doanh nghiệp mới vừa đăng ký trên hệ thống VKHO:</p><table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid #e5e7eb"><td style="padding:10px 12px;color:#6b7280;font-weight:600;width:140px">Tên công ty</td><td style="padding:10px 12px;color:#111827;font-weight:bold">${businessName}</td></tr><tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb"><td style="padding:10px 12px;color:#6b7280;font-weight:600">Tên ID (subdomain)</td><td style="padding:10px 12px;color:#111827;font-weight:bold">${subdomain}</td></tr><tr style="border-bottom:1px solid #e5e7eb"><td style="padding:10px 12px;color:#6b7280;font-weight:600">Người đăng ký</td><td style="padding:10px 12px;color:#111827">${adminName}</td></tr><tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb"><td style="padding:10px 12px;color:#6b7280;font-weight:600">Gmail</td><td style="padding:10px 12px;color:#1a56db">${email}</td></tr><tr><td style="padding:10px 12px;color:#6b7280;font-weight:600">Ngày đăng ký</td><td style="padding:10px 12px;color:#111827">${dateStr}</td></tr></table><div style="margin-top:20px;padding:12px;background:#ecfdf5;border-radius:6px;text-align:center;color:#065f46;font-weight:600">✅ Tài khoản đã được tạo thành công</div></div></div>`

    await transporter.sendMail({
      from: smtpUser,
      to: 'vphone24h@gmail.com',
      subject: `[VKHO] Đăng ký mới: ${businessName} (${subdomain})`,
      html: htmlContent,
    })

    console.log('Registration notification email sent successfully')
  } catch (error) {
    console.error('Failed to send registration notification email:', error)
  }
}

// Email Ngày 0 – Action email: Hướng dẫn 3 bước bắt đầu
async function sendDay0ActionEmail(toEmail: string, adminName: string, tenantId: string, supabaseAdmin: any) {
  try {
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')
    if (!smtpUser || !smtpPassword) return

    const name = adminName || 'anh/chị'
    const loginUrl = 'https://vkho.vn'

    const html = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:linear-gradient(135deg,#1a56db 0%,#1e40af 100%);padding:36px 32px;text-align:center">
            <p style="margin:0 0 8px;font-size:28px">⚡</p>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Cách quản lý kho trong 1 phút trên vKho</h1>
            <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px">2 bước đơn giản để bắt đầu ngay hôm nay</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px">
            <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Chào <strong>${name}</strong>, chào mừng đến với vKho!</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7">
              Để bắt đầu ngay, anh/chị chỉ cần làm <strong>2 bước đơn giản</strong>:
            </p>

            <!-- Step 1 - Nhập hàng -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1.5px solid #bbf7d0;border-radius:12px;overflow:hidden">
              <tr>
                <td style="background:#16a34a;padding:14px 20px;width:48px;text-align:center;vertical-align:top">
                  <span style="color:#fff;font-size:20px;font-weight:bold">1</span>
                </td>
                <td style="padding:14px 20px;background:#f0fdf4">
                  <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#166534">📥 Nhập hàng vào kho</p>
                  <p style="margin:0;font-size:13px;color:#374151;line-height:1.5">Tạo phiếu nhập để ghi nhận tồn kho ban đầu – sản phẩm được tạo tự động, có thể import từ Excel!</p>
                </td>
              </tr>
            </table>

            <!-- Step 2 - Bán hàng (Highlighted) -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;border:2px solid #dc2626;border-radius:12px;overflow:hidden">
              <tr>
                <td style="background:#dc2626;padding:14px 20px;width:48px;text-align:center;vertical-align:top">
                  <span style="color:#fff;font-size:20px;font-weight:bold">2</span>
                </td>
                <td style="padding:14px 20px;background:#fff1f2">
                  <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#b91c1c">🛒 Bán đơn đầu tiên ⭐ (Quan trọng nhất!)</p>
                  <p style="margin:0;font-size:13px;color:#374151;line-height:1.5">Tạo phiếu xuất, hệ thống tự tính lãi lỗ, cập nhật tồn kho và in phiếu ngay!</p>
                </td>
              </tr>
            </table>

            <div style="text-align:center;margin:0 0 24px">
              <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#1a56db,#1e40af);color:#fff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px">
                🚀 Bắt đầu ngay →
              </a>
            </div>

            <p style="margin:0;font-size:14px;color:#374151;line-height:1.7">
              Cần hỗ trợ? Phản hồi email này hoặc nhắn Zalo – em sẽ giúp ngay ạ!
            </p>
            <p style="margin:16px 0 0;font-size:14px;color:#374151">
              Trân trọng,<br><strong>Đội ngũ vKho.vn</strong><br>
              <span style="color:#6b7280">Zalo: <a href="https://zalo.me/0396793883" style="color:#1a56db;text-decoration:none">0396-793-883</a></span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#1e3a8a;padding:16px 32px;text-align:center">
            <p style="margin:0;font-size:12px;color:#93c5fd">© 2026 vKho – Hệ thống quản lý kho hàng thông minh</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    await transporter.sendMail({
      from: `"vKho" <${smtpUser}>`,
      to: toEmail,
      subject: `⚡ Cách quản lý kho trong 1 phút – 3 bước bắt đầu với vKho`,
      html,
    })

    // Ghi nhận đã gửi
    await supabaseAdmin.from('onboarding_email_logs').insert({
      tenant_id: tenantId,
      email_type: 'day_0_action',
      recipient_email: toEmail,
    })

    console.log('Day 0 action email sent to:', toEmail)
  } catch (err) {
    console.error('Day 0 action email failed:', err)
  }
}

async function sendWelcomeEmail(toEmail: string, adminName: string, subdomain: string, supabaseAdmin: any) {
  try {
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')

    if (!smtpUser || !smtpPassword) {
      console.error('SMTP credentials not configured for welcome email')
      return
    }

    const { data: configs } = await supabaseAdmin
      .from('payment_config')
      .select('config_key, config_value')
      .in('config_key', ['welcome_email_enabled', 'welcome_email_subject', 'welcome_email_body'])

    const configMap: Record<string, string> = {}
    for (const c of (configs || [])) {
      if (c.config_value) configMap[c.config_key] = c.config_value
    }

    if (configMap['welcome_email_enabled'] === 'false') {
      console.log('Welcome email is disabled, skipping')
      return
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    const emailSubject = (configMap['welcome_email_subject'] || '🎉 Chào mừng bạn đến với VKHO – Hệ thống quản lý kho thông minh!')
      .replace(/\{\{admin_name\}\}/g, adminName)
      .replace(/\{\{subdomain\}\}/g, subdomain)

    const customBody = configMap['welcome_email_body']
    
    let emailBody: string
    if (customBody) {
      emailBody = customBody
        .replace(/\{\{admin_name\}\}/g, adminName)
        .replace(/\{\{subdomain\}\}/g, subdomain)
        .replace(/\{\{business_name\}\}/g, adminName)
    } else {
      emailBody = [
        `<p style="font-size:16px;color:#374151;margin:0 0 20px">Xin chào <strong>${adminName}</strong>,</p>`,
        '<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px">Chào mừng bạn đã đến với <strong>VKHO</strong> – nền tảng quản lý kho chi tiết, đầy đủ và an toàn nhất!</p>',
        '<div style="background:#eff6ff;border-left:4px solid #1a56db;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 20px">',
          '<p style="margin:0 0 12px;font-size:15px;color:#1e40af;font-weight:bold">✨ Tính năng nổi bật:</p>',
          '<ul style="margin:0;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:2">',
            '<li><strong>Xuất – Nhập – Tồn</strong> chi tiết đến từng sản phẩm</li>',
            '<li>Giúp bạn dễ dàng <strong>quản lý sản phẩm</strong> và tư vấn khách hàng, gia tăng tỉ lệ chốt đơn</li>',
            '<li>Tích hợp <strong>báo cáo thuế</strong> cho người mới chưa rành – Nhấp là ra chi tiết</li>',
            '<li>Tích hợp <strong>website bán hàng</strong> và <strong>tra cứu bảo hành</strong> miễn phí</li>',
          '</ul>',
        '</div>',
        '<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px 20px;border-radius:8px;margin:0 0 20px;text-align:center">',
          `<p style="margin:0 0 4px;font-size:13px;color:#6b7280">ID cửa hàng của bạn</p>`,
          `<p style="margin:0;font-size:20px;font-weight:bold;color:#166534;font-family:monospace">${subdomain}</p>`,
        '</div>',
        '<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 8px">Mọi thắc mắc vui lòng liên hệ:</p>',
        '<p style="font-size:16px;color:#1a56db;font-weight:bold;margin:0 0 24px">📞 0396-793-883 (Zalo)</p>',
        '<div style="text-align:center">',
          '<p style="font-size:13px;color:#9ca3af;margin:0">Trân trọng,<br><strong style="color:#374151">Đội ngũ VKHO</strong></p>',
        '</div>',
      ].join('')
    }

    const htmlContent = [
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#f9fafb;border-radius:12px;overflow:hidden">',
        '<div style="background:linear-gradient(135deg,#1a56db,#2563eb);color:#fff;padding:32px 24px;text-align:center">',
          '<h1 style="margin:0 0 8px;font-size:24px;font-weight:bold">🎉 Chào mừng đến với VKHO!</h1>',
          '<p style="margin:0;font-size:14px;opacity:0.9">Hệ thống quản lý kho thông minh</p>',
        '</div>',
        '<div style="background:#fff;padding:32px 24px">',
          emailBody,
        '</div>',
        '<div style="background:#f3f4f6;padding:16px 24px;text-align:center">',
          '<p style="margin:0;font-size:12px;color:#9ca3af">© 2026 VKHO – Hệ thống quản lý kho hàng thông minh</p>',
        '</div>',
      '</div>',
    ].join('')

    await transporter.sendMail({
      from: `"VKHO" <${smtpUser}>`,
      to: toEmail,
      subject: emailSubject,
      html: htmlContent,
    })

    console.log('Welcome email sent to:', toEmail)
  } catch (error) {
    console.error('Failed to send welcome email:', error)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Rate limiting: 5 registrations per IP per 60 minutes
    const clientIP = getClientIP(req)
    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', {
      _function_name: 'register-tenant',
      _ip_address: clientIP,
      _max_requests: 5,
      _window_minutes: 60,
    })

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Request body size check
    const contentLength = parseInt(req.headers.get('content-length') || '0')
    if (contentLength > 10240) { // 10KB max
      return new Response(
        JSON.stringify({ error: 'Request quá lớn' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    
    // Sanitize and validate inputs
    const businessName = sanitizeString(body.businessName || '', 200)
    const subdomain = sanitizeString(body.subdomain || '', 32).toLowerCase()
    const adminName = sanitizeString(body.adminName || '', 200)
    const email = sanitizeString(body.email || '', 320).toLowerCase()
    const password = body.password || ''
    const phone = body.phone ? sanitizeString(body.phone, 20) : null

    // Validate required fields
    if (!businessName || !subdomain || !adminName || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    if (!validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Định dạng email không hợp lệ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate phone if provided
    if (phone && !validatePhone(phone)) {
      return new Response(
        JSON.stringify({ error: 'Số điện thoại không hợp lệ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password length
    if (password.length < 6 || password.length > 128) {
      return new Response(
        JSON.stringify({ error: 'Mật khẩu phải từ 6-128 ký tự' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate subdomain format - min 3 chars, max 32
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$|^[a-z0-9]{3}$/
    if (!subdomainRegex.test(subdomain) || subdomain.length < 3 || subdomain.length > 32) {
      return new Response(
        JSON.stringify({ error: 'ID cửa hàng không hợp lệ (3-32 ký tự, chỉ chữ thường, số và dấu gạch ngang)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if subdomain already exists
    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('subdomain', subdomain)
      .maybeSingle()

    if (existingTenant) {
      return new Response(
        JSON.stringify({ error: 'Tên miền phụ đã được sử dụng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('platform_users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email đã được sử dụng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if phone already exists
    if (phone) {
      const { data: existingPhone } = await supabaseAdmin
        .from('platform_users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (existingPhone) {
        return new Response(
          JSON.stringify({ error: 'Số điện thoại đã được sử dụng' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: existingTenantPhone } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (existingTenantPhone) {
        return new Response(
          JSON.stringify({ error: 'Số điện thoại đã được sử dụng' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create user account
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: adminName,
      },
    })

    if (createError) {
      console.error('Create user error:', createError)
      let errorMessage = createError.message
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        errorMessage = 'Email này đã được sử dụng'
      } else if (createError.message.includes('invalid email')) {
        errorMessage = 'Định dạng email không hợp lệ'
      } else if (createError.message.includes('password')) {
        errorMessage = 'Mật khẩu phải có ít nhất 6 ký tự'
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: businessName,
        subdomain,
        owner_id: newUser.user.id,
        status: 'trial',
        phone,
        email,
      })
      .select()
      .single()

    if (tenantError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      console.error('Create tenant error:', tenantError)
      return new Response(
        JSON.stringify({ error: 'Không thể tạo doanh nghiệp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create platform user record
    const { error: platformUserError } = await supabaseAdmin
      .from('platform_users')
      .insert({
        user_id: newUser.user.id,
        tenant_id: tenant.id,
        platform_role: 'tenant_admin',
        display_name: adminName,
        phone,
        email,
      })

    if (platformUserError) {
      console.error('Platform user error:', platformUserError)
    }

    // Update profiles with tenant_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ tenant_id: tenant.id })
      .eq('user_id', newUser.user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
    }

    // Create default branch
    const { data: defaultBranch, error: branchError } = await supabaseAdmin
      .from('branches')
      .insert({
        name: 'Chi nhánh chính',
        tenant_id: tenant.id,
        is_default: true,
      })
      .select()
      .single()

    if (branchError) {
      console.error('Branch create error:', branchError)
    }

    // Update user_roles
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .update({ 
        tenant_id: tenant.id,
        branch_id: defaultBranch?.id,
        user_role: 'super_admin'
      })
      .eq('user_id', newUser.user.id)

    if (roleError) {
      console.error('Role update error:', roleError)
    }

    // Create subscription history
    await supabaseAdmin
      .from('subscription_history')
      .insert({
        tenant_id: tenant.id,
        action: 'trial_start',
        new_status: 'trial',
        new_end_date: tenant.trial_end_date,
        note: 'Bắt đầu dùng thử 30 ngày',
      })

    // Create default point settings
    await supabaseAdmin
      .from('point_settings')
      .insert({ tenant_id: tenant.id })

    // Create default membership tier settings
    await supabaseAdmin
      .from('membership_tier_settings')
      .insert([
        { tenant_id: tenant.id, tier: 'regular', min_spent: 0, points_multiplier: 1 },
        { tenant_id: tenant.id, tier: 'silver', min_spent: 5000000, points_multiplier: 1.2 },
        { tenant_id: tenant.id, tier: 'gold', min_spent: 20000000, points_multiplier: 1.5 },
        { tenant_id: tenant.id, tier: 'vip', min_spent: 50000000, points_multiplier: 2 },
      ])

    // Send notification email to admin (non-blocking)
    sendRegistrationNotification(businessName, subdomain, email, adminName)
      .catch(err => console.error('Email notification error:', err))

    // Send welcome email to new user (non-blocking)
    sendWelcomeEmail(email, adminName, subdomain, supabaseAdmin)
      .catch(err => console.error('Welcome email error:', err))

    // Send Day 0 action email – hướng dẫn 3 bước bắt đầu (non-blocking)
    sendDay0ActionEmail(email, adminName, tenant.id, supabaseAdmin)
      .catch(err => console.error('Day 0 action email error:', err))

    return new Response(
      JSON.stringify({ 
        success: true, 
        tenant: {
          id: tenant.id,
          subdomain: tenant.subdomain,
          trialEndDate: tenant.trial_end_date,
        },
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Lỗi hệ thống' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
