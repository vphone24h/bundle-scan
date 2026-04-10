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
    const { toEmail } = await req.json()

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

    const adminName = 'Khách Hàng Test'
    const subdomain = 'demo-store'

    const htmlContent = [
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#f9fafb;border-radius:12px;overflow:hidden">',
        '<div style="background:linear-gradient(135deg,#1a56db,#2563eb);color:#fff;padding:32px 24px;text-align:center">',
          '<h1 style="margin:0 0 8px;font-size:24px;font-weight:bold">🎉 Chào mừng đến với VKHO!</h1>',
          '<p style="margin:0;font-size:14px;opacity:0.9">Hệ thống quản lý kho thông minh</p>',
        '</div>',
        '<div style="background:#fff;padding:32px 24px">',
          `<p style="font-size:16px;color:#374151;margin:0 0 20px">Xin chào <strong>${adminName}</strong>,</p>`,
          '<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px">Chào mừng bạn đã đến với <strong>VKHO</strong> – nền tảng quản lý kho chi tiết, đầy đủ và an toàn nhất!</p>',
          '<div style="background:#eff6ff;border-left:4px solid #1a56db;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 20px">',
            '<p style="margin:0 0 12px;font-size:15px;color:#1e40af;font-weight:bold">✨ Tính năng nổi bật:</p>',
            '<ul style="margin:0;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:2">',
              '<li><strong>Xuất – Nhập – Tồn</strong> chi tiết đến từng sản phẩm</li>',
              '<li>Giúp bạn dễ dàng <strong>quản lý sản phẩm</strong> và tư vấn khách hàng, gia tăng tỉ lệ chốt đơn</li>',
              '<li>Tích hợp <strong>báo cáo thuế</strong> cho người mới chưa rành – Nhấp là ra chi tiết</li>',
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
        '</div>',
        '<div style="background:#f3f4f6;padding:16px 24px;text-align:center">',
          '<p style="margin:0;font-size:12px;color:#9ca3af">© 2025 VKHO – Hệ thống quản lý kho hàng thông minh</p>',
        '</div>',
      '</div>',
    ].join('')

    await transporter.sendMail({
      from: `"VKHO" <${smtpUser}>`,
      to: toEmail,
      subject: '🎉 Chào mừng bạn đến với VKHO – Hệ thống quản lý kho thông minh!',
      html: htmlContent,
    })

    return new Response(JSON.stringify({ success: true, message: `Email sent to ${toEmail}` }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
