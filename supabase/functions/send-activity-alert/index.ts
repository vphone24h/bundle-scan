import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ'
}

function wrapEmail(content: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        ${content}
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

// ========== EXPORT RECEIPT EMAIL ==========
function buildExportEmail(data: {
  code: string
  staffName: string
  customerName: string
  customerPhone: string
  items: { name: string; imei?: string; price: number; qty: number }[]
  totalAmount: number
  paidAmount: number
  debtAmount: number
  adminName: string
}): string {
  const itemRows = data.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${item.name}${item.imei ? `<br><span style="color:#6b7280;font-size:11px">IMEI: ${item.imei}</span>` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center">${item.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;color:#059669;font-weight:bold">${formatMoney(item.price)}</td>
    </tr>`).join('')

  return wrapEmail(`
    <tr>
      <td style="background:linear-gradient(135deg,#059669,#10b981);padding:24px 32px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:20px">🛒 Phiếu xuất hàng mới</h1>
        <p style="margin:6px 0 0;color:#d1fae5;font-size:14px">Mã phiếu: <strong>${data.code}</strong></p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 8px">
        <p style="margin:0;font-size:14px;color:#334155">Xin chào <strong>${data.adminName || 'Anh/chị'}</strong>,</p>
        <p style="margin:6px 0 12px;font-size:13px;color:#64748b">Nhân viên <strong>${data.staffName}</strong> vừa xuất phiếu bán hàng:</p>
        <div style="background:#f0fdf4;padding:12px 16px;border-radius:8px;margin-bottom:12px">
          <p style="margin:0;font-size:13px;color:#334155"><strong>👤 Khách hàng:</strong> ${data.customerName} – ${data.customerPhone}</p>
        </div>
        <table width="100%" style="border-collapse:collapse;font-size:13px">
          <tr style="background:#f1f5f9">
            <td style="padding:8px 12px;font-weight:bold;color:#475569">Sản phẩm</td>
            <td style="padding:8px 12px;font-weight:bold;color:#475569;text-align:center">SL</td>
            <td style="padding:8px 12px;font-weight:bold;color:#475569;text-align:right">Giá bán</td>
          </tr>
          ${itemRows}
        </table>
        <div style="margin-top:12px;padding:12px 16px;background:#f1f5f9;border-radius:8px">
          <p style="margin:0;font-size:14px;color:#1e293b"><strong>Tổng tiền: ${formatMoney(data.totalAmount)}</strong></p>
          ${data.paidAmount > 0 ? `<p style="margin:4px 0 0;font-size:13px;color:#059669">Đã thanh toán: ${formatMoney(data.paidAmount)}</p>` : ''}
          ${data.debtAmount > 0 ? `<p style="margin:4px 0 0;font-size:13px;color:#dc2626">Còn nợ: ${formatMoney(data.debtAmount)}</p>` : ''}
        </div>
      </td>
    </tr>
    <tr><td style="padding:16px 32px 24px;text-align:center">
      <a href="https://vkho.vn" style="display:inline-block;background:#059669;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">Xem chi tiết trên vKho</a>
    </td></tr>`)
}

// ========== IMPORT RECEIPT EMAIL ==========
function buildImportEmail(data: {
  code: string
  staffName: string
  supplierName: string
  items: { name: string; imei?: string; price: number; qty: number }[]
  totalAmount: number
  paidAmount: number
  debtAmount: number
  adminName: string
}): string {
  const itemRows = data.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${item.name}${item.imei ? `<br><span style="color:#6b7280;font-size:11px">IMEI: ${item.imei}</span>` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center">${item.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;color:#2563eb;font-weight:bold">${formatMoney(item.price)}</td>
    </tr>`).join('')

  return wrapEmail(`
    <tr>
      <td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:24px 32px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:20px">📦 Phiếu nhập hàng mới</h1>
        <p style="margin:6px 0 0;color:#93c5fd;font-size:14px">Mã phiếu: <strong>${data.code}</strong></p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 8px">
        <p style="margin:0;font-size:14px;color:#334155">Xin chào <strong>${data.adminName || 'Anh/chị'}</strong>,</p>
        <p style="margin:6px 0 12px;font-size:13px;color:#64748b">Nhân viên <strong>${data.staffName}</strong> vừa nhập hàng:</p>
        <div style="background:#eff6ff;padding:12px 16px;border-radius:8px;margin-bottom:12px">
          <p style="margin:0;font-size:13px;color:#334155"><strong>🏭 Nhà cung cấp:</strong> ${data.supplierName || 'Không xác định'}</p>
        </div>
        <table width="100%" style="border-collapse:collapse;font-size:13px">
          <tr style="background:#f1f5f9">
            <td style="padding:8px 12px;font-weight:bold;color:#475569">Sản phẩm</td>
            <td style="padding:8px 12px;font-weight:bold;color:#475569;text-align:center">SL</td>
            <td style="padding:8px 12px;font-weight:bold;color:#475569;text-align:right">Giá nhập</td>
          </tr>
          ${itemRows}
        </table>
        <div style="margin-top:12px;padding:12px 16px;background:#f1f5f9;border-radius:8px">
          <p style="margin:0;font-size:14px;color:#1e293b"><strong>Tổng tiền: ${formatMoney(data.totalAmount)}</strong></p>
          ${data.paidAmount > 0 ? `<p style="margin:4px 0 0;font-size:13px;color:#059669">Đã thanh toán: ${formatMoney(data.paidAmount)}</p>` : ''}
          ${data.debtAmount > 0 ? `<p style="margin:4px 0 0;font-size:13px;color:#dc2626">Còn nợ: ${formatMoney(data.debtAmount)}</p>` : ''}
        </div>
      </td>
    </tr>
    <tr><td style="padding:16px 32px 24px;text-align:center">
      <a href="https://vkho.vn" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">Xem chi tiết trên vKho</a>
    </td></tr>`)
}

// ========== CASH BOOK EMAIL ==========
function buildCashBookEmail(data: {
  type: string
  category: string
  description: string
  amount: number
  paymentSource: string
  staffName: string
  recipientName?: string
  recipientPhone?: string
  adminName: string
  note?: string
}): string {
  const isIncome = data.type === 'income'
  const color = isIncome ? '#059669' : '#dc2626'
  const icon = isIncome ? '💰 Thu tiền' : '💸 Chi tiền'
  const bgGrad = isIncome ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#dc2626,#ef4444)'

  return wrapEmail(`
    <tr>
      <td style="background:${bgGrad};padding:24px 32px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:20px">${icon}</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px">${data.category}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 8px">
        <p style="margin:0;font-size:14px;color:#334155">Xin chào <strong>${data.adminName || 'Anh/chị'}</strong>,</p>
        <p style="margin:6px 0 12px;font-size:13px;color:#64748b">Nhân viên <strong>${data.staffName}</strong> vừa thực hiện giao dịch:</p>
        <div style="background:#f8fafc;padding:16px;border-radius:8px;border-left:4px solid ${color}">
          <p style="margin:0;font-size:13px;color:#64748b">Nội dung</p>
          <p style="margin:4px 0 12px;font-size:14px;color:#1e293b;font-weight:bold">${data.description}</p>
          <p style="margin:0;font-size:13px;color:#64748b">Số tiền</p>
          <p style="margin:4px 0 12px;font-size:20px;color:${color};font-weight:bold">${formatMoney(data.amount)}</p>
          <p style="margin:0;font-size:13px;color:#64748b">Nguồn tiền: <strong style="color:#334155">${data.paymentSource}</strong></p>
          ${data.recipientName ? `<p style="margin:8px 0 0;font-size:13px;color:#64748b">Người nhận: <strong style="color:#334155">${data.recipientName}${data.recipientPhone ? ' – ' + data.recipientPhone : ''}</strong></p>` : ''}
          ${data.note ? `<p style="margin:8px 0 0;font-size:13px;color:#64748b">Ghi chú: ${data.note}</p>` : ''}
        </div>
      </td>
    </tr>
    <tr><td style="padding:16px 32px 24px;text-align:center">
      <a href="https://vkho.vn" style="display:inline-block;background:${color};color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">Xem sổ quỹ trên vKho</a>
    </td></tr>`)
}

// ========== STOCK COUNT EMAIL ==========
function buildStockCountEmail(data: {
  code: string
  staffName: string
  branchName?: string
  totalItems: number
  scope: string
  adminName: string
  note?: string
}): string {
  const scopeText = data.scope === 'all' ? 'Tất cả sản phẩm' : data.scope === 'category' ? 'Theo danh mục' : 'Theo sản phẩm'

  return wrapEmail(`
    <tr>
      <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px 32px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:20px">📋 Phiếu kiểm kho mới</h1>
        <p style="margin:6px 0 0;color:#e9d5ff;font-size:14px">Mã phiếu: <strong>${data.code}</strong></p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 8px">
        <p style="margin:0;font-size:14px;color:#334155">Xin chào <strong>${data.adminName || 'Anh/chị'}</strong>,</p>
        <p style="margin:6px 0 12px;font-size:13px;color:#64748b">Nhân viên <strong>${data.staffName}</strong> vừa tạo phiếu kiểm kho:</p>
        <div style="background:#faf5ff;padding:16px;border-radius:8px;border-left:4px solid #7c3aed">
          ${data.branchName ? `<p style="margin:0 0 8px;font-size:13px;color:#64748b">Chi nhánh: <strong style="color:#334155">${data.branchName}</strong></p>` : ''}
          <p style="margin:0 0 8px;font-size:13px;color:#64748b">Phạm vi: <strong style="color:#334155">${scopeText}</strong></p>
          <p style="margin:0 0 8px;font-size:13px;color:#64748b">Số sản phẩm: <strong style="color:#334155">${data.totalItems}</strong></p>
          ${data.note ? `<p style="margin:0;font-size:13px;color:#64748b">Ghi chú: ${data.note}</p>` : ''}
        </div>
      </td>
    </tr>
    <tr><td style="padding:16px 32px 24px;text-align:center">
      <a href="https://vkho.vn" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">Xem phiếu kiểm kho</a>
    </td></tr>`)
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
      return new Response(JSON.stringify({ error: 'SMTP not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { type, tenant_id, data } = body as {
      type: 'export' | 'import' | 'cashbook' | 'stockcount'
      tenant_id: string
      data: any
    }

    if (!type || !tenant_id) {
      return new Response(JSON.stringify({ error: 'Missing type or tenant_id' }), {
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
      return new Response(JSON.stringify({ ok: true, skipped: 'no_admin' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminUserId = adminRoles[0].user_id

    // Skip if the action was performed by the admin themselves
    if (user.id === adminUserId) {
      return new Response(JSON.stringify({ ok: true, skipped: 'self_action' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('email')
      .eq('user_id', adminUserId)
      .maybeSingle()

    if (!platformUser?.email) {
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

    // Get staff name
    const { data: staffProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const staffName = staffProfile?.display_name || user.email || 'Nhân viên'

    let html = ''
    let subject = ''

    switch (type) {
      case 'export': {
        html = buildExportEmail({ ...data, staffName, adminName })
        subject = `🛒 Xuất hàng: ${data.code} – ${formatMoney(data.totalAmount)}`
        break
      }
      case 'import': {
        html = buildImportEmail({ ...data, staffName, adminName })
        subject = `📦 Nhập hàng: ${data.code} – ${formatMoney(data.totalAmount)}`
        break
      }
      case 'cashbook': {
        html = buildCashBookEmail({ ...data, staffName, adminName })
        const icon = data.type === 'income' ? '💰' : '💸'
        subject = `${icon} ${data.type === 'income' ? 'Thu' : 'Chi'}: ${formatMoney(data.amount)} – ${data.description}`
        break
      }
      case 'stockcount': {
        html = buildStockCountEmail({ ...data, staffName, adminName })
        subject = `📋 Kiểm kho: ${data.code} – ${data.totalItems} sản phẩm`
        break
      }
      default:
        return new Response(JSON.stringify({ error: 'Unknown type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

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

    console.log(`Activity alert [${type}] sent to ${platformUser.email}`)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error in send-activity-alert:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
