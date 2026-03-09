import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ'
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  buy_now: '🛒 Mua ngay',
  add_to_cart: '🛒 Thêm vào giỏ',
  pre_order: '📦 Đặt trước',
  notify_stock: '🔔 Báo khi có hàng',
  delivery: '🚚 Giao tận nơi',
  book_appointment: '📅 Đặt lịch',
  book_table: '🍽️ Đặt bàn',
  order_food: '🍜 Đặt món',
  book_service: '💆 Đặt dịch vụ',
  get_quote: '💬 Báo giá',
  send_request: '📝 Gửi yêu cầu',
  consult: '📞 Tư vấn',
  membership: '👤 Đăng ký thành viên',
}

function buildOrderAlertEmail(data: {
  orderCode: string
  actionType: string
  productName: string
  productPrice: number
  variant?: string
  quantity: number
  customerName: string
  customerPhone: string
  customerEmail?: string
  customerAddress?: string
  branchName?: string
  note?: string
  ctvName?: string
  adminName: string
}): string {
  const actionLabel = ACTION_TYPE_LABELS[data.actionType] || `📋 ${data.actionType}`
  
  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#fb923c);padding:24px 32px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:20px">🔔 Đơn hàng mới từ Website</h1>
            <p style="margin:6px 0 0;color:#fff9f0;font-size:14px">${actionLabel}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 8px">
            <p style="margin:0;font-size:14px;color:#334155">Xin chào <strong>${data.adminName || 'Anh/chị'}</strong>,</p>
            <p style="margin:6px 0 16px;font-size:13px;color:#64748b">Bạn vừa nhận được một đơn hàng mới từ Website bán hàng:</p>
            
            <div style="background:#fff7ed;padding:16px;border-radius:8px;border-left:4px solid #f97316;margin-bottom:16px">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b">Mã đơn hàng</p>
              <p style="margin:0;font-size:16px;color:#c2410c;font-weight:bold;font-family:monospace">${data.orderCode}</p>
            </div>
            
            <div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:16px">
              <h3 style="margin:0 0 12px;font-size:14px;color:#475569;text-transform:uppercase;letter-spacing:0.5px">📦 Thông tin sản phẩm</h3>
              <p style="margin:0 0 6px;font-size:14px;color:#1e293b;font-weight:bold">${data.productName}</p>
              ${data.variant ? `<p style="margin:0 0 6px;font-size:13px;color:#64748b">Phân loại: ${data.variant}</p>` : ''}
              <p style="margin:0 0 6px;font-size:13px;color:#64748b">Số lượng: ${data.quantity}</p>
              <p style="margin:0;font-size:16px;color:#dc2626;font-weight:bold">${formatMoney(data.productPrice * data.quantity)}</p>
            </div>
            
            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin-bottom:16px">
              <h3 style="margin:0 0 12px;font-size:14px;color:#475569;text-transform:uppercase;letter-spacing:0.5px">👤 Thông tin khách hàng</h3>
              <p style="margin:0 0 6px;font-size:14px;color:#1e293b"><strong>${data.customerName}</strong></p>
              <p style="margin:0 0 6px;font-size:13px;color:#334155">📞 <a href="tel:${data.customerPhone}" style="color:#059669;text-decoration:none;font-weight:600">${data.customerPhone}</a></p>
              ${data.customerEmail ? `<p style="margin:0 0 6px;font-size:13px;color:#334155">✉️ ${data.customerEmail}</p>` : ''}
              ${data.customerAddress ? `<p style="margin:0 0 6px;font-size:13px;color:#334155">📍 ${data.customerAddress}</p>` : ''}
              ${data.branchName ? `<p style="margin:0;font-size:13px;color:#64748b">Chi nhánh: ${data.branchName}</p>` : ''}
            </div>
            
            ${data.note ? `
            <div style="background:#fef3c7;padding:12px 16px;border-radius:8px;margin-bottom:16px">
              <p style="margin:0;font-size:13px;color:#92400e"><strong>📝 Ghi chú:</strong> ${data.note}</p>
            </div>` : ''}
            
            ${data.ctvName ? `
            <div style="background:#ede9fe;padding:12px 16px;border-radius:8px;margin-bottom:16px">
              <p style="margin:0;font-size:13px;color:#5b21b6"><strong>👥 CTV giới thiệu:</strong> ${data.ctvName}</p>
            </div>` : ''}
          </td>
        </tr>
        <tr><td style="padding:16px 32px 24px;text-align:center">
          <a href="https://vkho.vn" style="display:inline-block;background:#f97316;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">Xử lý đơn hàng ngay</a>
        </td></tr>
        <tr>
          <td style="background:#1e3a8a;padding:16px 32px;text-align:center">
            <p style="margin:0;font-size:12px;color:#93c5fd">© 2026 vKho – Hệ thống quản lý kho hàng thông minh</p>
            <p style="margin:4px 0 0;font-size:11px;color:#60a5fa">vkho.vn &nbsp;|&nbsp; Zalo: 0396-793-883</p>
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
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')

    if (!smtpUser || !smtpPassword) {
      console.log('SMTP not configured, skipping landing order alert')
      return new Response(JSON.stringify({ ok: true, skipped: 'smtp_not_configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const {
      tenant_id,
      order_id,
      order_code,
      action_type,
      product_name,
      product_price,
      variant,
      quantity,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      branch_id,
      note,
      ctv_name,
    } = await req.json()

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'Missing tenant_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get admin email (super_admin of this tenant)
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', tenant_id)
      .eq('user_role', 'super_admin')

    if (!adminRoles || adminRoles.length === 0) {
      console.log('No super_admin found for tenant:', tenant_id)
      return new Response(JSON.stringify({ ok: true, skipped: 'no_admin' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminUserId = adminRoles[0].user_id

    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('email')
      .eq('user_id', adminUserId)
      .maybeSingle()

    if (!platformUser?.email) {
      console.log('No email found for admin:', adminUserId)
      return new Response(JSON.stringify({ ok: true, skipped: 'no_email' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', adminUserId)
      .maybeSingle()

    const adminName = adminProfile?.display_name || ''

    // Get branch name
    let branchName = ''
    if (branch_id) {
      const { data: branch } = await supabase
        .from('branches')
        .select('name')
        .eq('id', branch_id)
        .maybeSingle()
      if (branch) branchName = branch.name || ''
    }

    const html = buildOrderAlertEmail({
      orderCode: order_code || order_id?.substring(0, 8)?.toUpperCase() || 'N/A',
      actionType: action_type || 'buy_now',
      productName: product_name || 'Sản phẩm',
      productPrice: product_price || 0,
      variant,
      quantity: quantity || 1,
      customerName: customer_name || 'Khách hàng',
      customerPhone: customer_phone || '',
      customerEmail: customer_email,
      customerAddress: customer_address,
      branchName,
      note,
      ctvName: ctv_name,
      adminName,
    })

    const actionLabel = ACTION_TYPE_LABELS[action_type] || action_type || 'Đơn hàng'
    const subject = `🔔 ${actionLabel}: ${customer_name || 'Khách hàng'} – ${product_name || 'Sản phẩm'}`

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    await transporter.sendMail({
      from: `"vKho" <${smtpUser}>`,
      to: platformUser.email,
      subject,
      html,
    })

    console.log(`Landing order alert sent to ${platformUser.email} for order ${order_code || order_id}`)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error in send-landing-order-alert:', error)
    // Return 200 to not break the main flow
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
