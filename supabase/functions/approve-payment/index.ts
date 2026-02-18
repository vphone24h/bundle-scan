import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ'
}

async function sendApprovalEmail(params: {
  toEmail: string
  adminName: string
  businessName: string
  planName: string
  planType: string
  amount: number
  newEndDate: Date
  durationDays: number | null
  hotline: string
  smtpUser: string
  smtpPassword: string
}) {
  const {
    toEmail, adminName, businessName, planName, planType,
    amount, newEndDate, durationDays, hotline, smtpUser, smtpPassword
  } = params

  const isLifetime = planType === 'lifetime' || !durationDays
  const expiryText = isLifetime
    ? 'Sử dụng vĩnh viễn – không giới hạn thời gian'
    : `Hết hạn vào: <strong>${formatDate(newEndDate)}</strong>`

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
              Xin chào <strong>${adminName || businessName || 'bạn'}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7">
              Chúng tôi vui mừng thông báo rằng yêu cầu gia hạn của bạn đã được <strong style="color:#1a56db">duyệt thành công</strong>. 
              Tài khoản <strong>${businessName || adminName}</strong> hiện đã được nâng cấp và sẵn sàng sử dụng đầy đủ tính năng.
            </p>

            <!-- Plan Info Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;margin:0 0 24px;overflow:hidden">
              <tr>
                <td style="padding:20px 24px">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px">Gói đã đăng ký</p>
                  <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1e40af">${planName}</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;border-top:1px solid #dbeafe">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:14px;color:#6b7280">💰 Số tiền thanh toán</td>
                            <td align="right" style="font-size:15px;font-weight:700;color:#1e40af">${formatCurrency(amount)}</td>
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
                            <td align="right" style="font-size:14px;font-weight:600;color:#374151">${businessName}</td>
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
              📞 Hotline/Zalo: <a href="tel:${hotline.replace(/\s/g, '')}" style="color:#1a56db;font-weight:600;text-decoration:none">${hotline}</a>
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
    subject: `✅ Gia hạn thành công – Gói ${planName} | VKHO`,
    html,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rlClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: allowed } = await rlClient.rpc('check_rate_limit', { _function_name: 'approve-payment', _ip_address: clientIP, _max_requests: 10, _window_minutes: 60 })
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Không có quyền truy cập' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify caller
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Không thể xác thực người dùng' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if caller is platform admin
    const { data: platformUser } = await supabaseAdmin
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', caller.id)
      .single()

    if (!platformUser || platformUser.platform_role !== 'platform_admin') {
      return new Response(
        JSON.stringify({ error: 'Chỉ Admin nền tảng mới có quyền thực hiện' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { paymentId, action, rejectedReason, bonusDays } = await req.json()

    if (!paymentId || !action) {
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get payment request with tenant and plan info
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payment_requests')
      .select(`
        *,
        tenants (*),
        subscription_plans (*)
      `)
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy yêu cầu thanh toán' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (payment.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Yêu cầu thanh toán đã được xử lý' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'approve') {
      const plan = payment.subscription_plans
      const tenant = payment.tenants
      
      // Calculate new subscription end date
      let newEndDate: Date
      const now = new Date()
      
      if (plan.plan_type === 'lifetime') {
        newEndDate = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
      } else {
        const currentEndDate = tenant.subscription_end_date 
          ? new Date(tenant.subscription_end_date)
          : now
        
        const baseDate = currentEndDate > now ? currentEndDate : now
        const daysToAdd = (plan.duration_days || 30) + (bonusDays || 0)
        newEndDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
      }

      // Update payment request
      await supabaseAdmin
        .from('payment_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: caller.id,
        })
        .eq('id', paymentId)

      // Update tenant
      await supabaseAdmin
        .from('tenants')
        .update({
          status: 'active',
          subscription_plan: plan.plan_type,
          subscription_start_date: now.toISOString(),
          subscription_end_date: newEndDate.toISOString(),
          max_branches: plan.max_branches,
          max_users: plan.max_users,
          locked_at: null,
          locked_reason: null,
        })
        .eq('id', tenant.id)

      // Create subscription history
      await supabaseAdmin
        .from('subscription_history')
        .insert({
          tenant_id: tenant.id,
          plan_id: plan.id,
          payment_request_id: paymentId,
          action: 'subscription_start',
          old_status: tenant.status,
          new_status: 'active',
          old_end_date: tenant.subscription_end_date,
          new_end_date: newEndDate.toISOString(),
          days_added: plan.duration_days,
          performed_by: caller.id,
          note: `Kích hoạt gói ${plan.name}${bonusDays ? ` + ${bonusDays} ngày bonus` : ''}`,
        })

      // === Gửi email xác nhận ===
      const smtpUser = Deno.env.get('SMTP_USER')
      const smtpPassword = Deno.env.get('SMTP_PASSWORD')

      if (smtpUser && smtpPassword) {
        try {
          // Lấy email và tên admin của tenant
          const { data: tenantAdmin } = await supabaseAdmin
            .from('platform_users')
            .select('user_id')
            .eq('tenant_id', tenant.id)
            .eq('is_active', true)
            .limit(1)
            .single()

          let customerEmail: string | null = null
          let customerName: string | null = null

          if (tenantAdmin?.user_id) {
            const { data: { user: tenantUser } } = await supabaseAdmin.auth.admin.getUserById(tenantAdmin.user_id)
            customerEmail = tenantUser?.email || null

            // Lấy tên hiển thị từ profiles
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('display_name')
              .eq('user_id', tenantAdmin.user_id)
              .single()
            customerName = profile?.display_name || null
          }

          // Lấy hotline từ payment_config
          const { data: configs } = await supabaseAdmin
            .from('payment_config')
            .select('config_key, config_value')
            .in('config_key', ['hotline', 'feedback_hotline'])

          const hotline = configs?.find(c => c.config_key === 'hotline')?.config_value
            || configs?.find(c => c.config_key === 'feedback_hotline')?.config_value
            || '0396-793-883'

          if (customerEmail) {
            await sendApprovalEmail({
              toEmail: customerEmail,
              adminName: customerName || tenant.business_name || tenant.subdomain,
              businessName: tenant.business_name || tenant.subdomain,
              planName: plan.name,
              planType: plan.plan_type,
              amount: payment.amount,
              newEndDate,
              durationDays: plan.duration_days,
              hotline,
              smtpUser,
              smtpPassword,
            })
            console.log('Approval email sent to:', customerEmail)
          }
        } catch (emailError) {
          // Không fail toàn bộ request nếu gửi mail lỗi
          console.error('Failed to send approval email:', emailError)
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Đã duyệt thanh toán thành công',
          newEndDate: newEndDate.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'reject') {
      await supabaseAdmin
        .from('payment_requests')
        .update({
          status: 'rejected',
          rejected_reason: rejectedReason || 'Không đạt yêu cầu',
        })
        .eq('id', paymentId)

      return new Response(
        JSON.stringify({ success: true, message: 'Đã từ chối yêu cầu thanh toán' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Hành động không hợp lệ' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Lỗi hệ thống' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
