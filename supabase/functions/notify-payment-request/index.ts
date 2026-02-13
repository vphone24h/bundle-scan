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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { paymentRequestId } = await req.json()

    if (!paymentRequestId) {
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payment_requests')
      .select(`
        *,
        tenants (name, subdomain, email, phone),
        subscription_plans (name, plan_type, price)
      `)
      .eq('id', paymentRequestId)
      .single()

    if (paymentError || !payment) {
      console.error('Payment not found:', paymentError)
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy yêu cầu thanh toán' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')

    if (!smtpUser || !smtpPassword) {
      console.error('SMTP credentials not configured')
      return new Response(
        JSON.stringify({ success: true, message: 'SMTP not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenant = payment.tenants as any
    const plan = payment.subscription_plans as any

    const now = new Date()
    const dateStr = now.toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
    })

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('vi-VN').format(price) + 'đ'
    }

    const planTypeMap: Record<string, string> = {
      monthly: 'Tháng',
      yearly: 'Năm',
      lifetime: 'Trọn đời',
    }

    const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb;border-radius:8px">
      <div style="background:#d97706;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="margin:0;font-size:20px">💰 Yêu cầu mua gói mới - VKHO</h1>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <p style="font-size:16px;color:#374151;margin-bottom:16px">Có yêu cầu mua gói dịch vụ mới cần duyệt:</p>
        <table style="width:100%;border-collapse:collapse">
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 12px;color:#6b7280;font-weight:600;width:140px">Tên cửa hàng</td>
            <td style="padding:10px 12px;color:#111827;font-weight:bold">${tenant?.name || 'N/A'}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb">
            <td style="padding:10px 12px;color:#6b7280;font-weight:600">Tên ID</td>
            <td style="padding:10px 12px;color:#111827;font-weight:bold">${tenant?.subdomain || 'N/A'}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 12px;color:#6b7280;font-weight:600">Email</td>
            <td style="padding:10px 12px;color:#1a56db">${tenant?.email || 'N/A'}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb">
            <td style="padding:10px 12px;color:#6b7280;font-weight:600">SĐT</td>
            <td style="padding:10px 12px;color:#111827">${tenant?.phone || 'N/A'}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 12px;color:#6b7280;font-weight:600">Gói đăng ký</td>
            <td style="padding:10px 12px;color:#111827;font-weight:bold">${plan?.name || 'N/A'} (${planTypeMap[plan?.plan_type] || plan?.plan_type})</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb">
            <td style="padding:10px 12px;color:#6b7280;font-weight:600">Số tiền</td>
            <td style="padding:10px 12px;color:#dc2626;font-weight:bold;font-size:18px">${formatPrice(payment.amount)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 12px;color:#6b7280;font-weight:600">Mã thanh toán</td>
            <td style="padding:10px 12px;color:#111827;font-family:monospace">${payment.payment_code}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;color:#6b7280;font-weight:600">Ngày yêu cầu</td>
            <td style="padding:10px 12px;color:#111827">${dateStr}</td>
          </tr>
        </table>
        <div style="margin-top:20px;padding:12px;background:#fef3c7;border-radius:6px;text-align:center;color:#92400e;font-weight:600">
          ⏳ Đang chờ duyệt - Vui lòng kiểm tra và xử lý
        </div>
      </div>
    </div>`

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })

    await transporter.sendMail({
      from: smtpUser,
      to: 'vphone24h@gmail.com',
      subject: `[VKHO] Yêu cầu mua gói: ${tenant?.name} - ${plan?.name} (${formatPrice(payment.amount)})`,
      html: htmlContent,
    })

    console.log('Payment request notification email sent successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending payment notification:', error)
    return new Response(
      JSON.stringify({ success: true, warning: 'Email notification failed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
