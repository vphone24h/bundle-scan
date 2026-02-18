import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildEmailHtml(params: {
  adminName: string
  businessName: string
  subdomain: string
  hotline: string
  zalo: string
}) {
  const { adminName, businessName, zalo, hotline } = params
  const loginUrl = `https://vkho.vn`

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a56db 0%,#1e40af 100%);padding:36px 32px;text-align:center">
            <p style="margin:0 0 8px;font-size:28px">👋</p>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Bắt đầu sử dụng vKho nào!</h1>
            <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px">Chỉ 5–10 phút thiết lập, hệ thống sẽ tự động làm việc cho bạn</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px">
            <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">
              Chào <strong>${adminName || businessName || 'anh/chị'}</strong>,
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7">
              Em thấy anh/chị đã đăng ký <strong>vKho</strong> được 3 ngày, nhưng có vẻ mình chưa bắt đầu sử dụng.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7">
              Không biết anh/chị có gặp khó khăn trong quá trình cài đặt hay chưa rõ cách sử dụng phần nào không ạ?
            </p>

            <!-- Benefits -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;margin:0 0 24px">
              <tr>
                <td style="padding:20px 24px">
                  <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1e40af">vKho được thiết kế để giúp anh/chị:</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="font-size:14px;color:#374151;padding:5px 0;line-height:1.5">📦&nbsp; <strong>Theo dõi tồn kho</strong> chính xác theo từng sản phẩm, chi nhánh</td></tr>
                    <tr><td style="font-size:14px;color:#374151;padding:5px 0;line-height:1.5">💰&nbsp; <strong>Tự động tính lãi lỗ</strong> cho mỗi đơn hàng, mỗi tháng</td></tr>
                    <tr><td style="font-size:14px;color:#374151;padding:5px 0;line-height:1.5">📋&nbsp; <strong>Quản lý công nợ</strong> khách hàng và nhà cung cấp rõ ràng</td></tr>
                    <tr><td style="font-size:14px;color:#374151;padding:5px 0;line-height:1.5">🌐&nbsp; <strong>Tích hợp website bán hàng</strong> & tra cứu bảo hành miễn phí</td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;padding:16px 20px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0">
              ⚡ Chỉ cần <strong>5–10 phút thiết lập ban đầu</strong>, hệ thống sẽ bắt đầu ghi nhận và phân tích dữ liệu cho mình ngay.
            </p>

            <!-- Support offer -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;margin:0 0 28px">
              <tr>
                <td style="padding:20px 24px">
                  <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#92400e">🤝 Nếu anh/chị cần, em có thể:</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="font-size:14px;color:#374151;padding:4px 0">✅&nbsp; Hỗ trợ cài đặt <strong>miễn phí</strong> qua Zalo/điện thoại</td></tr>
                    <tr><td style="font-size:14px;color:#374151;padding:4px 0">✅&nbsp; Gửi video hướng dẫn nhanh từng bước</td></tr>
                  </table>
                  <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">Anh/chị chỉ cần phản hồi lại email này, em sẽ hỗ trợ ngay ạ.</p>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            <div style="text-align:center;margin:0 0 8px">
              <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#1a56db,#1e40af);color:#fff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px">
                🚀 Bắt đầu sử dụng ngay →
              </a>
            </div>
          </td>
        </tr>

        <!-- Closing -->
        <tr>
          <td style="padding:0 32px 28px">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.7">
              Rất mong được đồng hành cùng anh/chị trong việc quản lý kinh doanh hiệu quả hơn.
            </p>
            <p style="margin:16px 0 0;font-size:14px;color:#374151">
              Trân trọng,<br>
              <strong>Đội ngũ vKho.vn</strong><br>
              <span style="color:#6b7280">Zalo: <a href="https://zalo.me/${zalo.replace(/\s/g,'')}" style="color:#1a56db;text-decoration:none">${zalo}</a></span><br>
              <span style="color:#6b7280">Hotline: <a href="tel:${hotline.replace(/\s/g,'')}" style="color:#1a56db;text-decoration:none">${hotline}</a></span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a8a;padding:16px 32px;text-align:center">
            <p style="margin:0;font-size:12px;color:#93c5fd">© 2026 VKHO – Hệ thống quản lý kho hàng thông minh</p>
            <p style="margin:4px 0 0;font-size:11px;color:#60a5fa">vkho.vn</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const smtpUser = Deno.env.get('SMTP_USER')!
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Lấy cấu hình hotline & zalo
    const { data: configs } = await supabaseAdmin
      .from('payment_config')
      .select('config_key, config_value')
      .in('config_key', ['hotline', 'feedback_zalo_url', 'feedback_hotline'])

    const hotline = configs?.find(c => c.config_key === 'hotline')?.config_value
      || configs?.find(c => c.config_key === 'feedback_hotline')?.config_value
      || '0396-793-883'
    const zalo = configs?.find(c => c.config_key === 'feedback_zalo_url')?.config_value
      || '0396 793 883'

    // Tìm tenants đăng ký đúng 3 ngày trước, chưa có sản phẩm
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)

    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id, subdomain, business_name, created_at')
      .in('status', ['trial', 'active'])
      .gte('created_at', fourDaysAgo.toISOString())
      .lte('created_at', threeDaysAgo.toISOString())

    if (!tenants || tenants.length === 0) {
      console.log('No inactive tenants found')
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    let sent = 0
    let skipped = 0

    for (const tenant of tenants) {
      try {
        // Kiểm tra đã có sản phẩm chưa
        const { count: productCount } = await supabaseAdmin
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)

        if ((productCount || 0) > 0) {
          skipped++
          continue // Đã có sản phẩm → bỏ qua
        }

        // Kiểm tra đã gửi email này chưa
        const { count: emailSentCount } = await supabaseAdmin
          .from('email_queue')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('email_type', 'inactive_reminder_3d')

        if ((emailSentCount || 0) > 0) {
          skipped++
          continue // Đã gửi rồi → bỏ qua
        }

        // Lấy thông tin admin của tenant
        const { data: platformUser } = await supabaseAdmin
          .from('platform_users')
          .select('user_id')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .limit(1)
          .single()

        if (!platformUser) continue

        const { data: { user: tenantUser } } = await supabaseAdmin.auth.admin.getUserById(platformUser.user_id)
        if (!tenantUser?.email) continue

        // Lấy tên hiển thị
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('display_name')
          .eq('user_id', platformUser.user_id)
          .single()

        const adminName = profile?.display_name || tenant.business_name || tenant.subdomain
        const businessName = tenant.business_name || tenant.subdomain

        const html = buildEmailHtml({ adminName, businessName, subdomain: tenant.subdomain, hotline, zalo })
        const subject = `👋 ${adminName}, vKho đang chờ bạn bắt đầu!`

        // Gửi email
        await transporter.sendMail({
          from: `"vKho" <${smtpUser}>`,
          to: tenantUser.email,
          subject,
          html,
        })

        // Ghi nhận vào email_queue
        await supabaseAdmin.from('email_queue').insert({
          tenant_id: tenant.id,
          recipient_email: tenantUser.email,
          recipient_user_id: platformUser.user_id,
          email_type: 'inactive_reminder_3d',
          subject,
          body_html: html,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })

        sent++
        console.log(`Sent inactive reminder to: ${tenantUser.email} (${businessName})`)
      } catch (err) {
        console.error(`Error processing tenant ${tenant.id}:`, err)
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
