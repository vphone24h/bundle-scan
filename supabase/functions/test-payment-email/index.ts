import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // Verify secret token for security
    const { toEmail, secret } = await req.json()
    if (secret !== 'vkho-test-2026') {
      return new Response(JSON.stringify({ error: 'Invalid secret' }), { status: 403, headers: corsHeaders })
    }
    const smtpUser = Deno.env.get('SMTP_USER')!
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')!

    const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const expiryText = `Hết hạn vào: <strong>${newEndDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>`

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a56db 0%,#1e40af 100%);padding:36px 32px;text-align:center">
            <p style="margin:0 0 8px;font-size:28px">✅</p>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px">Thanh toán thành công!</h1>
            <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px">Gói dịch vụ của bạn đã được kích hoạt</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px">
            <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">
              Xin chào <strong>Vphone24h</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7">
              Chúng tôi vui mừng thông báo rằng yêu cầu gia hạn của bạn đã được <strong style="color:#1a56db">duyệt thành công</strong>. 
              Tài khoản <strong>Vphone24h</strong> hiện đã được nâng cấp và sẵn sàng sử dụng đầy đủ tính năng.
            </p>

            <!-- Plan Info Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;margin:0 0 24px;overflow:hidden">
              <tr>
                <td style="padding:20px 24px">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px">Gói đã đăng ký</p>
                  <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1e40af">Gói Tháng</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;border-top:1px solid #dbeafe">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:14px;color:#6b7280">💰 Số tiền thanh toán</td>
                            <td align="right" style="font-size:15px;font-weight:700;color:#1e40af">299,000đ</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;border-top:1px solid #dbeafe">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:14px;color:#6b7280">📅 Thời hạn sử dụng</td>
                            <td align="right" style="font-size:14px;color:#1e40af">${expiryText}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;border-top:1px solid #dbeafe">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:14px;color:#6b7280">🏪 Cửa hàng</td>
                            <td align="right" style="font-size:14px;font-weight:600;color:#374151">Vphone24h</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- What's included -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin:0 0 24px">
              <tr>
                <td style="padding:20px 24px">
                  <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#15803d">🎉 Bạn được sử dụng đầy đủ tính năng:</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="font-size:13px;color:#374151;padding:3px 0">✅&nbsp; Quản lý kho, nhập/xuất hàng không giới hạn</td></tr>
                    <tr><td style="font-size:13px;color:#374151;padding:3px 0">✅&nbsp; Báo cáo doanh thu, lợi nhuận chi tiết</td></tr>
                    <tr><td style="font-size:13px;color:#374151;padding:3px 0">✅&nbsp; CRM khách hàng & chăm sóc tự động</td></tr>
                    <tr><td style="font-size:13px;color:#374151;padding:3px 0">✅&nbsp; Website bán hàng & tra cứu bảo hành</td></tr>
                    <tr><td style="font-size:13px;color:#374151;padding:3px 0">✅&nbsp; Không hiển thị quảng cáo</td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Thank you message -->
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;padding:16px 20px;background:#fefce8;border-left:4px solid #fbbf24;border-radius:0 8px 8px 0">
              💛 <strong>Cảm ơn bạn đã đồng hành cùng VKHO!</strong><br>
              Chúng tôi cam kết không ngừng cải tiến để mang đến trải nghiệm quản lý kho hàng tốt nhất cho bạn. 
              Sự tin tưởng của bạn là động lực lớn nhất của chúng tôi.
            </p>
          </td>
        </tr>

        <!-- Support -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb">
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#374151">🤝 Cần hỗ trợ? Chúng tôi luôn sẵn sàng!</p>
            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">
              Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ đội ngũ hỗ trợ qua:<br>
              📞 Hotline/Zalo: <a href="tel:0396793883" style="color:#1a56db;font-weight:600;text-decoration:none">0396-793-883</a>
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

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    await transporter.sendMail({
      from: `"VKHO" <${smtpUser}>`,
      to: toEmail,
      subject: `✅ [TEST] Gia hạn thành công – Gói Tháng | VKHO`,
      html,
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
