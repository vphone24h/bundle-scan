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
    const { email, password, full_name, phone, tenant_id, redirect_url } = await req.json()

    if (!email || !password || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, tenant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Get store SMTP credentials and info
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('tenant_landing_settings')
      .select('order_email_sender, order_email_app_password, store_name')
      .eq('tenant_id', tenant_id)
      .single()

    if (settingsErr || !settings?.order_email_sender || !settings?.order_email_app_password) {
      return new Response(
        JSON.stringify({ error: 'Cửa hàng chưa cấu hình email gửi. Vui lòng liên hệ chủ cửa hàng.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Get tenant info for subdomain
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('store_name, business_name, subdomain')
      .eq('id', tenant_id)
      .single()

    const storeName = settings.store_name || tenant?.store_name || tenant?.business_name || 'Cửa hàng'

    // 3. Create user via admin API (no default email sent)
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Don't auto-confirm
      user_metadata: {
        full_name,
        phone,
        ctv_tenant_id: tenant_id,
      },
    })

    if (createErr) {
      // Check for duplicate email
      if (createErr.message?.includes('already been registered') || createErr.message?.includes('already exists')) {
        return new Response(
          JSON.stringify({ error: 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw createErr
    }

    // 4. Generate confirmation link
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      options: {
        redirectTo: redirect_url || `https://${tenant?.subdomain}.vkho.vn`,
      },
    })

    if (linkErr) {
      console.error('Error generating link:', linkErr)
      // User was created but link failed - still success, they can request new link
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Tài khoản đã được tạo. Vui lòng yêu cầu gửi lại email xác nhận.',
          user_id: userData.user?.id 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const confirmationUrl = linkData.properties?.action_link

    // 5. Send email via store's Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: settings.order_email_sender,
        pass: settings.order_email_app_password,
      },
    })

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05)">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:32px 24px;text-align:center">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700">${storeName}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px">Chào mừng CTV mới</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:32px 24px">
              <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;font-weight:600">Xác nhận email của bạn</h2>
              
              <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6">
                Xin chào <strong>${full_name || 'bạn'}</strong>,
              </p>
              
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6">
                Cảm ơn bạn đã đăng ký làm Cộng tác viên tại <strong>${storeName}</strong>. 
                Vui lòng nhấn nút bên dưới để xác nhận email và kích hoạt tài khoản CTV của bạn.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0">
                    <a href="${confirmationUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;box-shadow:0 2px 4px rgba(59,130,246,0.3)">
                      ✅ Xác nhận Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;text-align:center">
                Link này sẽ hết hạn sau 24 giờ.<br>
                Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center">
              <p style="margin:0;color:#9ca3af;font-size:12px">
                © ${new Date().getFullYear()} ${storeName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

    await transporter.sendMail({
      from: `"${storeName}" <${settings.order_email_sender}>`,
      to: email,
      subject: `Xác nhận đăng ký CTV - ${storeName}`,
      html: emailHtml,
    })

    console.log(`CTV verification email sent to ${email} from store ${storeName}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.',
        user_id: userData.user?.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('CTV signup error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Đã xảy ra lỗi khi đăng ký' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
