import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Email template helpers ────────────────────────────────────────────────

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

// Ngày 2 – Nhắc nhập hàng
function buildDay2Email(adminName: string): string {
  const name = adminName || 'anh/chị'
  const loginUrl = 'https://vkho.vn'
  return wrapEmail(`
    <tr>
      <td style="background:linear-gradient(135deg,#1a56db 0%,#1e40af 100%);padding:36px 32px;text-align:center">
        <p style="margin:0 0 8px;font-size:28px">📦</p>
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${name} đã nhập hàng vào vKho chưa?</h1>
        <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px">Chỉ 2 phút để có tồn kho đầu tiên</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 32px 28px">
        <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Chào <strong>${name}</strong>,</p>
        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7">
          Bước quan trọng nhất để bắt đầu với vKho là <strong>nhập hàng vào kho</strong>. Sau khi nhập hàng, bạn sẽ có thể:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;margin:0 0 24px">
          <tr><td style="padding:20px 24px">
            <table cellpadding="0" cellspacing="0">
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">📊&nbsp; <strong>Theo dõi tồn kho</strong> theo từng sản phẩm, chi nhánh</td></tr>
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">💰&nbsp; <strong>Tự động tính lãi lỗ</strong> khi bán hàng</td></tr>
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">📋&nbsp; <strong>In phiếu nhập</strong> chuyên nghiệp cho nhà cung cấp</td></tr>
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">🔍&nbsp; <strong>Tra cứu IMEI/bảo hành</strong> miễn phí cho khách</td></tr>
            </table>
          </td></tr>
        </table>
        <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:14px 20px;border-radius:0 8px 8px 0;margin:0 0 28px">
          <p style="margin:0;font-size:14px;color:#166534;line-height:1.6">
            ⚡ <strong>Mẹo nhanh:</strong> Bạn có thể nhập nhiều sản phẩm cùng lúc bằng file Excel – chỉ mất 2 phút!
          </p>
        </div>
        <div style="text-align:center;margin:0 0 8px">
          <a href="${loginUrl}/import/new" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px">
            📦 Nhập hàng ngay →
          </a>
        </div>
        <p style="margin:20px 0 0;font-size:14px;color:#374151;line-height:1.7">
          Nếu cần hỗ trợ, chỉ cần phản hồi email này – em sẽ giúp ngay ạ!
        </p>
        <p style="margin:16px 0 0;font-size:14px;color:#374151">
          Trân trọng,<br><strong>Đội ngũ vKho.vn</strong><br>
          <span style="color:#6b7280">Zalo: <a href="https://zalo.me/0396793883" style="color:#1a56db;text-decoration:none">0396-793-883</a></span>
        </p>
      </td>
    </tr>`, '')
}

// Ngày 5 – Video hướng dẫn
function buildDay5Email(adminName: string): string {
  const name = adminName || 'anh/chị'
  const loginUrl = 'https://vkho.vn'
  return wrapEmail(`
    <tr>
      <td style="background:linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%);padding:36px 32px;text-align:center">
        <p style="margin:0 0 8px;font-size:28px">🎬</p>
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Video: Cách dùng vKho trong 3 phút</h1>
        <p style="margin:8px 0 0;color:#ddd6fe;font-size:14px">Xem xong là biết làm ngay</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 32px 28px">
        <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Chào <strong>${name}</strong>,</p>
        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7">
          Em gửi anh/chị video hướng dẫn ngắn – chỉ <strong>3 phút</strong> là nắm được toàn bộ cách sử dụng vKho:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;margin:0 0 24px">
          <tr><td style="padding:20px 24px">
            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#5b21b6">📹 Nội dung video bao gồm:</p>
            <table cellpadding="0" cellspacing="0">
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">✅&nbsp; Thêm sản phẩm & nhập hàng (1 phút)</td></tr>
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">✅&nbsp; Tạo phiếu bán hàng (1 phút)</td></tr>
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">✅&nbsp; Xem báo cáo lãi lỗ & tồn kho (1 phút)</td></tr>
            </table>
          </td></tr>
        </table>
        <div style="text-align:center;margin:0 0 24px">
          <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px">
            🎬 Xem video hướng dẫn →
          </a>
        </div>
        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin:0 0 20px">
          <p style="margin:0;font-size:14px;color:#92400e;line-height:1.6">
            💡 <strong>Mẹo:</strong> Sau khi xem video, thử bán đơn hàng đầu tiên – cảm giác rất thú vị khi thấy hệ thống tự tính lãi lỗ cho mình!
          </p>
        </div>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.7">Cần hỗ trợ thêm, phản hồi email này nhé!</p>
        <p style="margin:16px 0 0;font-size:14px;color:#374151">
          Trân trọng,<br><strong>Đội ngũ vKho.vn</strong><br>
          <span style="color:#6b7280">Zalo: <a href="https://zalo.me/0396793883" style="color:#1a56db;text-decoration:none">0396-793-883</a></span>
        </p>
      </td>
    </tr>`, '')
}

// Ngày 10 – Nhắc bán đơn đầu tiên (email quan trọng nhất)
function buildDay10Email(adminName: string): string {
  const name = adminName || 'anh/chị'
  const loginUrl = 'https://vkho.vn'
  return wrapEmail(`
    <tr>
      <td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:36px 32px;text-align:center">
        <p style="margin:0 0 8px;font-size:28px">🛒</p>
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${name} đã thử bán đơn đầu tiên chưa?</h1>
        <p style="margin:8px 0 0;color:#fecaca;font-size:14px">Đây là bước tạo ra doanh thu thực tế đầu tiên</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 32px 28px">
        <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Chào <strong>${name}</strong>,</p>
        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7">
          Sau khi nhập hàng, bước tiếp theo quan trọng nhất là <strong>tạo phiếu bán hàng đầu tiên</strong>.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff1f2;border:1.5px solid #fecaca;border-radius:12px;margin:0 0 24px">
          <tr><td style="padding:20px 24px">
            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#b91c1c">🎯 Khi tạo đơn bán hàng đầu tiên, bạn sẽ thấy:</p>
            <table cellpadding="0" cellspacing="0">
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">💵&nbsp; <strong>Lãi lỗ tự động tính</strong> ngay khi bán xong</td></tr>
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">📉&nbsp; <strong>Tồn kho tự động cập nhật</strong> – không cần nhập tay</td></tr>
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">🧾&nbsp; <strong>In phiếu xuất</strong> chuyên nghiệp trong 2 giây</td></tr>
              <tr><td style="font-size:14px;color:#374151;padding:6px 0;line-height:1.5">👤&nbsp; <strong>Lịch sử mua hàng của khách</strong> được lưu tự động</td></tr>
            </table>
          </td></tr>
        </table>
        <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:14px 20px;border-radius:0 8px 8px 0;margin:0 0 28px">
          <p style="margin:0;font-size:14px;color:#166534;line-height:1.6">
            ⚡ <strong>Chỉ 30 giây</strong> để tạo một đơn bán hàng – chọn sản phẩm → nhập số lượng → in phiếu → xong!
          </p>
        </div>
        <div style="text-align:center;margin:0 0 8px">
          <a href="${loginUrl}/export/new" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;padding:16px 48px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(220,38,38,0.3)">
            🛒 Tạo đơn bán hàng đầu tiên →
          </a>
        </div>
        <p style="margin:20px 0 0;font-size:15px;color:#374151;line-height:1.7;font-style:italic;text-align:center;color:#6b7280">
          "Khách hàng đầu tiên luôn đặc biệt – hãy để vKho ghi lại khoảnh khắc đó!"
        </p>
        <p style="margin:24px 0 0;font-size:14px;color:#374151;line-height:1.7">Nếu gặp khó khăn, em luôn sẵn sàng hỗ trợ!</p>
        <p style="margin:16px 0 0;font-size:14px;color:#374151">
          Trân trọng,<br><strong>Đội ngũ vKho.vn</strong><br>
          <span style="color:#6b7280">Zalo: <a href="https://zalo.me/0396793883" style="color:#1a56db;text-decoration:none">0396-793-883</a></span>
        </p>
      </td>
    </tr>`, '')
}

// ─── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const smtpUser = Deno.env.get('SMTP_USER')!
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')!

    if (!smtpUser || !smtpPassword) {
      return new Response(JSON.stringify({ error: 'SMTP not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    const results = { day2: 0, day5: 0, day10: 0, skipped: 0, errors: 0 }

    // Helper: kiểm tra đã gửi email chưa
    async function alreadySent(tenantId: string, emailType: string): Promise<boolean> {
      const { count } = await supabaseAdmin
        .from('onboarding_email_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('email_type', emailType)
      return (count || 0) > 0
    }

    // Helper: lấy thông tin admin + email của tenant
    async function getTenantAdmin(tenantId: string) {
      const { data: pu } = await supabaseAdmin
        .from('platform_users')
        .select('user_id, display_name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(1)
        .single()
      if (!pu) return null

      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(pu.user_id)
      if (!user?.email) return null

      return { email: user.email, name: pu.display_name || '' }
    }

    // Helper: ghi nhận đã gửi
    async function logSent(tenantId: string, emailType: string, recipientEmail: string) {
      await supabaseAdmin.from('onboarding_email_logs').insert({
        tenant_id: tenantId,
        email_type: emailType,
        recipient_email: recipientEmail,
      })
    }

    // Helper: lấy danh sách tenant đăng ký trong khoảng ngày
    async function getTenantsRegisteredBetween(daysAgo: number) {
      const start = new Date(Date.now() - (daysAgo + 1) * 24 * 60 * 60 * 1000)
      const end   = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('id, subdomain, name')
        .in('status', ['trial', 'active'])
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
      return data || []
    }

    // ── Ngày 2: Nhắc nhập hàng ──────────────────────────────────────────
    const day2Tenants = await getTenantsRegisteredBetween(2)
    for (const tenant of day2Tenants) {
      try {
        if (await alreadySent(tenant.id, 'day_2_import')) { results.skipped++; continue }
        // Chỉ gửi nếu CHƯA có hàng nhập
        const { count: importCount } = await supabaseAdmin
          .from('import_receipts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
        if ((importCount || 0) > 0) { results.skipped++; continue }

        const admin = await getTenantAdmin(tenant.id)
        if (!admin) continue

        const html = buildDay2Email(admin.name)
        const subject = `📦 ${admin.name || 'Anh/chị'}, đã nhập hàng vào vKho chưa?`
        await transporter.sendMail({ from: `"vKho" <${smtpUser}>`, to: admin.email, subject, html })
        await logSent(tenant.id, 'day_2_import', admin.email)
        results.day2++
      } catch (err) {
        console.error(`Day 2 error for tenant ${tenant.id}:`, err)
        results.errors++
      }
    }

    // ── Ngày 5: Gửi video hướng dẫn ─────────────────────────────────────
    const day5Tenants = await getTenantsRegisteredBetween(5)
    for (const tenant of day5Tenants) {
      try {
        if (await alreadySent(tenant.id, 'day_5_video')) { results.skipped++; continue }

        const admin = await getTenantAdmin(tenant.id)
        if (!admin) continue

        const html = buildDay5Email(admin.name)
        const subject = `🎬 Video: Cách dùng vKho trong 3 phút`
        await transporter.sendMail({ from: `"vKho" <${smtpUser}>`, to: admin.email, subject, html })
        await logSent(tenant.id, 'day_5_video', admin.email)
        results.day5++
      } catch (err) {
        console.error(`Day 5 error for tenant ${tenant.id}:`, err)
        results.errors++
      }
    }

    // ── Ngày 10: Nhắc bán đơn đầu tiên ──────────────────────────────────
    const day10Tenants = await getTenantsRegisteredBetween(10)
    for (const tenant of day10Tenants) {
      try {
        if (await alreadySent(tenant.id, 'day_10_sell')) { results.skipped++; continue }
        // Chỉ gửi nếu CHƯA có đơn bán
        const { count: exportCount } = await supabaseAdmin
          .from('export_receipts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
        if ((exportCount || 0) > 0) { results.skipped++; continue }

        const admin = await getTenantAdmin(tenant.id)
        if (!admin) continue

        const html = buildDay10Email(admin.name)
        const subject = `🛒 ${admin.name || 'Anh/chị'} đã thử bán đơn đầu tiên chưa?`
        await transporter.sendMail({ from: `"vKho" <${smtpUser}>`, to: admin.email, subject, html })
        await logSent(tenant.id, 'day_10_sell', admin.email)
        results.day10++
      } catch (err) {
        console.error(`Day 10 error for tenant ${tenant.id}:`, err)
        results.errors++
      }
    }

    console.log('Onboarding sequence results:', results)
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
