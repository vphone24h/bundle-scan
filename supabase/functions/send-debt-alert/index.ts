import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function wrapEmail(content: string, smtpUser: string): string {
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

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ'
}

interface DebtSummary {
  tenant_id: string
  tenant_name: string
  admin_email: string
  admin_name: string
  overdue_days: number
  due_today: { count: number; total: number; items: { name: string; phone: string; amount: number; days: number }[] }
  overdue: { count: number; total: number; items: { name: string; phone: string; amount: number; days: number }[] }
  near_due: { count: number; total: number }
}

function buildDebtAlertEmail(summary: DebtSummary): string {
  const { due_today, overdue, near_due, admin_name, overdue_days } = summary

  let alertRows = ''

  // Overdue items (red)
  if (overdue.count > 0) {
    alertRows += `
      <tr>
        <td style="padding:16px 32px">
          <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;border-radius:8px;margin-bottom:8px">
            <h3 style="margin:0 0 8px;color:#dc2626;font-size:16px">🔴 Quá hạn: ${overdue.count} khoản – ${formatMoney(overdue.total)}</h3>
            <p style="margin:0;font-size:13px;color:#991b1b">Đã quá ${overdue_days} ngày chưa thanh toán</p>
            <table width="100%" style="margin-top:12px;font-size:13px;border-collapse:collapse">
              <tr style="background:#fecaca">
                <td style="padding:6px 8px;font-weight:bold;color:#991b1b">Khách hàng</td>
                <td style="padding:6px 8px;font-weight:bold;color:#991b1b">SĐT</td>
                <td style="padding:6px 8px;font-weight:bold;color:#991b1b;text-align:right">Còn nợ</td>
                <td style="padding:6px 8px;font-weight:bold;color:#991b1b;text-align:right">Ngày</td>
              </tr>
              ${overdue.items.slice(0, 10).map(item => `
              <tr>
                <td style="padding:6px 8px;border-bottom:1px solid #fecaca">${item.name}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #fecaca">${item.phone || '—'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #fecaca;text-align:right;color:#dc2626;font-weight:bold">${formatMoney(item.amount)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #fecaca;text-align:right">${item.days} ngày</td>
              </tr>`).join('')}
              ${overdue.items.length > 10 ? `<tr><td colspan="4" style="padding:6px 8px;color:#991b1b;font-style:italic">...và ${overdue.items.length - 10} khoản khác</td></tr>` : ''}
            </table>
          </div>
        </td>
      </tr>`
  }

  // Due today items (orange)
  if (due_today.count > 0) {
    alertRows += `
      <tr>
        <td style="padding:0 32px 16px">
          <div style="background:#fff7ed;border-left:4px solid #f97316;padding:16px;border-radius:8px">
            <h3 style="margin:0 0 8px;color:#ea580c;font-size:16px">🟠 Cần thu hôm nay: ${due_today.count} khoản – ${formatMoney(due_today.total)}</h3>
            <table width="100%" style="margin-top:12px;font-size:13px;border-collapse:collapse">
              <tr style="background:#fed7aa">
                <td style="padding:6px 8px;font-weight:bold;color:#9a3412">Khách hàng</td>
                <td style="padding:6px 8px;font-weight:bold;color:#9a3412">SĐT</td>
                <td style="padding:6px 8px;font-weight:bold;color:#9a3412;text-align:right">Còn nợ</td>
                <td style="padding:6px 8px;font-weight:bold;color:#9a3412;text-align:right">Ngày</td>
              </tr>
              ${due_today.items.slice(0, 10).map(item => `
              <tr>
                <td style="padding:6px 8px;border-bottom:1px solid #fed7aa">${item.name}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #fed7aa">${item.phone || '—'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #fed7aa;text-align:right;color:#ea580c;font-weight:bold">${formatMoney(item.amount)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #fed7aa;text-align:right">${item.days} ngày</td>
              </tr>`).join('')}
              ${due_today.items.length > 10 ? `<tr><td colspan="4" style="padding:6px 8px;color:#9a3412;font-style:italic">...và ${due_today.items.length - 10} khoản khác</td></tr>` : ''}
            </table>
          </div>
        </td>
      </tr>`
  }

  // Near due summary (yellow)
  if (near_due.count > 0) {
    alertRows += `
      <tr>
        <td style="padding:0 32px 16px">
          <div style="background:#fefce8;border-left:4px solid #eab308;padding:16px;border-radius:8px">
            <h3 style="margin:0;color:#a16207;font-size:16px">🟡 Sắp đến hạn: ${near_due.count} khoản – ${formatMoney(near_due.total)}</h3>
            <p style="margin:4px 0 0;font-size:13px;color:#854d0e">Còn 1-3 ngày nữa là đến hạn thu nợ</p>
          </div>
        </td>
      </tr>`
  }

  if (!alertRows) return '' // No alerts needed

  const content = `
    <tr>
      <td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:32px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:22px">⚠️ Cảnh báo Công nợ</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px">Báo cáo tự động hàng ngày</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px 8px">
        <p style="margin:0;font-size:15px;color:#334155">Xin chào <strong>${admin_name || 'Anh/chị'}</strong>,</p>
        <p style="margin:8px 0;font-size:14px;color:#64748b">Dưới đây là tình hình công nợ cần chú ý của cửa hàng hôm nay:</p>
      </td>
    </tr>
    ${alertRows}
    <tr>
      <td style="padding:16px 32px 24px;text-align:center">
        <a href="https://vkho.vn" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
          Xem chi tiết trên vKho
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 24px">
        <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Email này được gửi tự động mỗi ngày. Nếu không còn công nợ cần thu, bạn sẽ không nhận email này.</p>
      </td>
    </tr>`

  return wrapEmail(content, '')
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

    // Get all active tenants
    const { data: tenants, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, subdomain')
      .in('status', ['active', 'trial'])

    if (tenantErr) throw tenantErr

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    let emailsSent = 0

    for (const tenant of (tenants || [])) {
      // Get debt settings for this tenant
      const { data: debtSettings } = await supabase
        .from('debt_settings')
        .select('overdue_days')
        .eq('tenant_id', tenant.id)
        .maybeSingle()

      const overdueDays = debtSettings?.overdue_days ?? 15

      // Get admin email (super_admin of this tenant)
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('tenant_id', tenant.id)
        .eq('user_role', 'super_admin')

      if (!adminRoles || adminRoles.length === 0) continue

      // Get admin email from platform_users
      const adminUserId = adminRoles[0].user_id
      const { data: platformUser } = await supabase
        .from('platform_users')
        .select('email, user_id')
        .eq('user_id', adminUserId)
        .maybeSingle()

      if (!platformUser?.email) continue

      // Get admin name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', adminUserId)
        .maybeSingle()

      // Get customer debts for this tenant
      // We need to calculate remaining amounts from import_receipts and debt_payments
      const { data: importReceipts } = await supabase
        .from('import_receipts')
        .select('id, supplier_id, customer_id, total_amount, paid_amount, created_at, branch_id')
        .eq('tenant_id', tenant.id)

      const { data: exportReceipts } = await supabase
        .from('export_receipts')
        .select('id, customer_id, total_amount, paid_amount, created_at, branch_id, export_date')
        .eq('tenant_id', tenant.id)
        .eq('status', 'completed')

      // Get manual debts
      const { data: debtPayments } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('tenant_id', tenant.id)

      // Get customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, phone, debt_due_days')
        .eq('tenant_id', tenant.id)

      const customerMap = new Map((customers || []).map(c => [c.id, c]))

      // Calculate customer debts from export receipts
      const customerDebts = new Map<string, { name: string; phone: string; total_remaining: number; oldest_date: string }>()

      for (const er of (exportReceipts || [])) {
        if (!er.customer_id) continue
        const remaining = (er.total_amount || 0) - (er.paid_amount || 0)
        if (remaining <= 0) continue

        const existing = customerDebts.get(er.customer_id)
        const customer = customerMap.get(er.customer_id)
        if (!customer) continue

        if (existing) {
          existing.total_remaining += remaining
          if (er.export_date < existing.oldest_date) existing.oldest_date = er.export_date
        } else {
          customerDebts.set(er.customer_id, {
            name: customer.name,
            phone: customer.phone || '',
            total_remaining: remaining,
            oldest_date: er.export_date || er.created_at,
          })
        }
      }

      // Also add manual debt additions
      for (const dp of (debtPayments || [])) {
        if (dp.entity_type !== 'customer') continue
        const customer = customerMap.get(dp.entity_id)
        if (!customer) continue

        const amount = dp.payment_type === 'addition' ? dp.amount : -dp.amount
        const existing = customerDebts.get(dp.entity_id)
        if (existing) {
          existing.total_remaining += amount
        } else if (amount > 0) {
          customerDebts.set(dp.entity_id, {
            name: customer.name,
            phone: customer.phone || '',
            total_remaining: amount,
            oldest_date: dp.created_at,
          })
        }
      }

      // Categorize debts
      const now = new Date()
      const dueTodayItems: { name: string; phone: string; amount: number; days: number }[] = []
      const overdueItems: { name: string; phone: string; amount: number; days: number }[] = []
      let nearDueCount = 0
      let nearDueTotal = 0

      for (const [customerId, debt] of customerDebts) {
        if (debt.total_remaining <= 0) continue

        const customer = customerMap.get(customerId)
        const customerOverdueDays = customer?.debt_due_days || overdueDays
        const daysSince = Math.floor((now.getTime() - new Date(debt.oldest_date).getTime()) / (1000 * 60 * 60 * 24))

        if (daysSince >= customerOverdueDays) {
          overdueItems.push({ name: debt.name, phone: debt.phone, amount: debt.total_remaining, days: daysSince })
        } else if (daysSince >= customerOverdueDays - 1) {
          dueTodayItems.push({ name: debt.name, phone: debt.phone, amount: debt.total_remaining, days: daysSince })
        } else if (daysSince >= customerOverdueDays - 3) {
          nearDueCount++
          nearDueTotal += debt.total_remaining
        }
      }

      // Only send email if there are alerts
      if (overdueItems.length === 0 && dueTodayItems.length === 0 && nearDueCount === 0) continue

      // Sort by amount desc
      overdueItems.sort((a, b) => b.amount - a.amount)
      dueTodayItems.sort((a, b) => b.amount - a.amount)

      const summary: DebtSummary = {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        admin_email: platformUser.email,
        admin_name: profile?.display_name || '',
        overdue_days: overdueDays,
        due_today: { count: dueTodayItems.length, total: dueTodayItems.reduce((s, i) => s + i.amount, 0), items: dueTodayItems },
        overdue: { count: overdueItems.length, total: overdueItems.reduce((s, i) => s + i.amount, 0), items: overdueItems },
        near_due: { count: nearDueCount, total: nearDueTotal },
      }

      const html = buildDebtAlertEmail(summary)
      if (!html) continue

      const totalAlert = summary.overdue.count + summary.due_today.count
      const subject = `⚠️ Cảnh báo công nợ: ${totalAlert} khoản cần thu – ${formatMoney(summary.overdue.total + summary.due_today.total)}`

      try {
        await transporter.sendMail({
          from: `"vKho" <${smtpUser}>`,
          to: platformUser.email,
          subject,
          html,
        })
        emailsSent++
        console.log(`Debt alert sent to ${platformUser.email} for tenant ${tenant.name}`)
      } catch (mailErr) {
        console.error(`Failed to send debt alert to ${platformUser.email}:`, mailErr)
      }
    }

    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error in send-debt-alert:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
