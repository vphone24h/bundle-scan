import nodemailer from 'npm:nodemailer@6.9.10'
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ'
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  buy_now: 'Đặt hàng',
  add_to_cart: 'Đặt hàng',
  pre_order: 'Đặt trước',
  notify_stock: 'Đăng ký thông báo',
  delivery: 'Đặt giao hàng',
  book_appointment: 'Đặt lịch',
  book_table: 'Đặt bàn',
  order_food: 'Đặt món',
  book_service: 'Đặt dịch vụ',
  get_quote: 'Yêu cầu báo giá',
  send_request: 'Gửi yêu cầu',
  consult: 'Đăng ký tư vấn',
  membership: 'Đăng ký thành viên',
  booking: 'Đặt lịch',
}

function buildCustomerConfirmationEmail(data: {
  orderCode: string
  actionType: string
  productName: string
  productPrice: number
  variant?: string
  quantity: number
  customerName: string
  customerAddress?: string
  branchName?: string
  note?: string
  shopName: string
  shopPhone?: string
  actionDate?: string
  actionTime?: string
}): string {
  const actionLabel = ACTION_TYPE_LABELS[data.actionType] || 'Đặt hàng'
  const hasBooking = data.actionDate || data.actionTime

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:24px 32px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:20px">✅ ${actionLabel} thành công!</h1>
            <p style="margin:6px 0 0;color:#dbeafe;font-size:14px">${data.shopName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 8px">
            <p style="margin:0;font-size:14px;color:#334155">Xin chào <strong>${data.customerName}</strong>,</p>
            <p style="margin:6px 0 16px;font-size:13px;color:#64748b">Cảm ơn bạn đã ${actionLabel.toLowerCase()}. Chúng tôi đã nhận được yêu cầu của bạn và sẽ xử lý trong thời gian sớm nhất.</p>
            
            <div style="background:#eff6ff;padding:16px;border-radius:8px;border-left:4px solid #2563eb;margin-bottom:16px">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b">Mã đơn hàng</p>
              <p style="margin:0;font-size:16px;color:#1d4ed8;font-weight:bold;font-family:monospace">${data.orderCode}</p>
            </div>
            
            <div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:16px">
              <h3 style="margin:0 0 12px;font-size:14px;color:#475569;text-transform:uppercase;letter-spacing:0.5px">📦 Chi tiết</h3>
              <p style="margin:0 0 6px;font-size:14px;color:#1e293b;font-weight:bold">${data.productName}</p>
              ${data.variant ? `<p style="margin:0 0 6px;font-size:13px;color:#64748b">Phân loại: ${data.variant}</p>` : ''}
              <p style="margin:0 0 6px;font-size:13px;color:#64748b">Số lượng: ${data.quantity}</p>
              <p style="margin:0;font-size:16px;color:#dc2626;font-weight:bold">${formatMoney(data.productPrice * data.quantity)}</p>
            </div>

            ${hasBooking ? `
            <div style="background:#fef3c7;padding:16px;border-radius:8px;margin-bottom:16px">
              <h3 style="margin:0 0 8px;font-size:14px;color:#92400e">📅 Thời gian hẹn</h3>
              ${data.actionDate ? `<p style="margin:0 0 4px;font-size:13px;color:#78350f">Ngày: <strong>${data.actionDate}</strong></p>` : ''}
              ${data.actionTime ? `<p style="margin:0;font-size:13px;color:#78350f">Giờ: <strong>${data.actionTime}</strong></p>` : ''}
            </div>` : ''}

            ${data.customerAddress ? `
            <div style="background:#f0fdf4;padding:12px 16px;border-radius:8px;margin-bottom:16px">
              <p style="margin:0;font-size:13px;color:#166534">📍 Địa chỉ: ${data.customerAddress}</p>
            </div>` : ''}

            ${data.branchName ? `
            <div style="background:#f0fdf4;padding:12px 16px;border-radius:8px;margin-bottom:16px">
              <p style="margin:0;font-size:13px;color:#166534">🏪 Chi nhánh: ${data.branchName}</p>
            </div>` : ''}

            ${data.note ? `
            <div style="background:#fef3c7;padding:12px 16px;border-radius:8px;margin-bottom:16px">
              <p style="margin:0;font-size:13px;color:#92400e"><strong>📝 Ghi chú:</strong> ${data.note}</p>
            </div>` : ''}

            <div style="background:#fefce8;padding:16px;border-radius:8px;margin-bottom:16px;text-align:center">
              <p style="margin:0;font-size:13px;color:#854d0e">Nếu cần hỗ trợ, vui lòng liên hệ cửa hàng:</p>
              ${data.shopPhone ? `<p style="margin:6px 0 0;font-size:15px;color:#1e293b;font-weight:bold">📞 ${data.shopPhone}</p>` : ''}
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#1e3a8a;padding:16px 32px;text-align:center">
            <p style="margin:0;font-size:12px;color:#93c5fd">Cảm ơn bạn đã tin tưởng ${data.shopName}!</p>
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb = createClient(supabaseUrl, supabaseKey)

  try {
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')

    if (!smtpUser || !smtpPassword) {
      return new Response(JSON.stringify({ ok: true, skipped: 'smtp_not_configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const {
      customer_email,
      customer_name,
      customer_address,
      order_code,
      action_type,
      product_name,
      product_price,
      variant,
      quantity,
      branch_name,
      note,
      shop_name,
      shop_phone,
      action_date,
      action_time,
      tenant_id,
    } = await req.json()

    if (!customer_email) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_customer_email' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const actionLabel = ACTION_TYPE_LABELS[action_type] || 'Đặt hàng'

    const html = buildCustomerConfirmationEmail({
      orderCode: order_code || 'N/A',
      actionType: action_type || 'buy_now',
      productName: product_name || 'Sản phẩm',
      productPrice: product_price || 0,
      variant,
      quantity: quantity || 1,
      customerName: customer_name || 'Quý khách',
      customerAddress: customer_address,
      branchName: branch_name,
      note,
      shopName: shop_name || 'Cửa hàng',
      shopPhone: shop_phone,
      actionDate: action_date,
      actionTime: action_time,
    })

    const subject = `✅ ${actionLabel} thành công – ${product_name || 'Sản phẩm'} | ${shop_name || 'Cửa hàng'}`

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    await transporter.sendMail({
      from: `"${shop_name || 'Cửa hàng'}" <${smtpUser}>`,
      to: customer_email,
      subject,
      html,
    })

    console.log(`Customer confirmation sent to ${customer_email} for order ${order_code}`)

    // Log to platform_email_automation_logs
    await sb.from('platform_email_automation_logs').insert({
      recipient_email: customer_email,
      recipient_name: customer_name || null,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      body_html: html,
      tenant_id: tenant_id || null,
      automation_id: null,
    }).then(({ error: logErr }) => {
      if (logErr) console.warn('Failed to log email:', logErr.message)
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error in send-customer-order-confirmation:', error)

    // Log failure
    try {
      const body = await req.clone().json().catch(() => ({}))
      await sb.from('platform_email_automation_logs').insert({
        recipient_email: body.customer_email || 'unknown',
        recipient_name: body.customer_name || null,
        subject: `order_confirmation`,
        status: 'failed',
        error_message: error.message,
        body_html: null,
        tenant_id: body.tenant_id || null,
        automation_id: null,
      })
    } catch {}

    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
