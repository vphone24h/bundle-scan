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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      tenant_id,
      order_id,
      customer_name,
      customer_email,
      customer_phone,
      product_name,
      product_price,
      order_code,
      variant,
      quantity,
      branch_id,
      email_type = 'order_confirmation',
    } = await req.json()

    if (!tenant_id || !customer_email || !order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tenant landing settings for email config
    const { data: settings } = await supabaseAdmin
      .from('tenant_landing_settings')
      .select('order_email_enabled, order_email_sender, order_email_app_password, store_name, store_phone, store_address')
      .eq('tenant_id', tenant_id)
      .single()

    if (!settings?.order_email_enabled || !settings?.order_email_sender || !settings?.order_email_app_password) {
      console.log('Order email not configured or disabled for tenant:', tenant_id)
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Email not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get branch info
    let branchName = ''
    let branchAddress = ''
    let branchPhone = ''
    if (branch_id) {
      const { data: branch } = await supabaseAdmin
        .from('branches')
        .select('name, address, phone')
        .eq('id', branch_id)
        .single()
      if (branch) {
        branchName = branch.name || ''
        branchAddress = branch.address || ''
        branchPhone = branch.phone || ''
      }
    }

    const storeName = settings.store_name || 'Cửa hàng'
    const storePhone = branchPhone || settings.store_phone || ''
    const storeAddress = branchAddress || settings.store_address || ''

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('vi-VN').format(price) + 'đ'
    }

    let subject = ''
    let htmlContent = ''

    if (email_type === 'order_confirmation') {
      subject = `Xác nhận đơn hàng tại ${storeName}`
      htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#ffffff">
          <div style="background:#1a1a2e;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:22px;font-weight:bold">✅ Xác nhận đơn hàng</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#a0aec0">${storeName}</p>
          </div>
          <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
            <p style="font-size:16px;color:#2d3748;margin:0 0 20px">Xin chào <strong>${customer_name || 'Quý khách'}</strong>,</p>
            <p style="font-size:14px;color:#4a5568;margin:0 0 20px">Cảm ơn bạn đã đặt hàng tại <strong>${storeName}</strong>.</p>
            
            <div style="background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 20px">
              <h3 style="margin:0 0 12px;font-size:14px;color:#718096;text-transform:uppercase;letter-spacing:0.5px">Thông tin đơn hàng</h3>
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:8px 0;color:#718096;font-size:14px">Sản phẩm:</td>
                  <td style="padding:8px 0;color:#2d3748;font-size:14px;font-weight:600;text-align:right">${product_name}${variant ? ` (${variant})` : ''}</td>
                </tr>
                ${quantity > 1 ? `<tr>
                  <td style="padding:8px 0;color:#718096;font-size:14px">Số lượng:</td>
                  <td style="padding:8px 0;color:#2d3748;font-size:14px;text-align:right">${quantity}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:8px 0;color:#718096;font-size:14px">Giá:</td>
                  <td style="padding:8px 0;color:#e53e3e;font-size:18px;font-weight:bold;text-align:right">${formatPrice(product_price)}</td>
                </tr>
                ${order_code ? `<tr>
                  <td style="padding:8px 0;color:#718096;font-size:14px">Mã đơn hàng:</td>
                  <td style="padding:8px 0;color:#2d3748;font-size:14px;font-weight:600;font-family:monospace;text-align:right">${order_code}</td>
                </tr>` : ''}
              </table>
            </div>

            <p style="font-size:14px;color:#4a5568;margin:0 0 16px">Cửa hàng sẽ liên hệ với bạn sớm nhất.</p>

            ${storePhone || storeAddress ? `
            <div style="background:#edf2f7;border-radius:8px;padding:16px;margin:0 0 20px">
              <h3 style="margin:0 0 8px;font-size:14px;color:#4a5568;font-weight:600">📞 Thông tin liên hệ</h3>
              ${branchName ? `<p style="margin:4px 0;font-size:14px;color:#2d3748;font-weight:600">${branchName}</p>` : ''}
              ${storePhone ? `<p style="margin:4px 0;font-size:14px;color:#2d3748">Hotline: <a href="tel:${storePhone}" style="color:#3182ce;text-decoration:none;font-weight:600">${storePhone}</a></p>` : ''}
              ${storeAddress ? `<p style="margin:4px 0;font-size:14px;color:#718096">Địa chỉ: ${storeAddress}</p>` : ''}
            </div>` : ''}

            <p style="font-size:14px;color:#718096;margin:0;text-align:center">Trân trọng,<br /><strong>${storeName}</strong></p>
          </div>
        </div>`
    } else if (email_type === 'order_confirmed') {
      subject = `Đơn hàng đã được xác nhận - ${storeName}`
      htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#ffffff">
          <div style="background:#38a169;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:22px">✅ Đơn hàng đã xác nhận</h1>
          </div>
          <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
            <p style="font-size:16px;color:#2d3748">Xin chào <strong>${customer_name || 'Quý khách'}</strong>,</p>
            <p style="font-size:14px;color:#4a5568">Đơn hàng <strong>${order_code || ''}</strong> của bạn đã được xác nhận.</p>
            <p style="font-size:14px;color:#4a5568">Sản phẩm: <strong>${product_name}</strong></p>
            <p style="font-size:14px;color:#4a5568">Giá: <strong style="color:#e53e3e">${formatPrice(product_price)}</strong></p>
            <p style="font-size:14px;color:#718096;margin-top:20px">Trân trọng,<br /><strong>${storeName}</strong></p>
          </div>
        </div>`
    } else if (email_type === 'order_shipping') {
      subject = `Đơn hàng đang được giao - ${storeName}`
      htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
          <div style="background:#3182ce;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:22px">🚚 Đang giao hàng</h1>
          </div>
          <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
            <p style="font-size:16px;color:#2d3748">Xin chào <strong>${customer_name || 'Quý khách'}</strong>,</p>
            <p style="font-size:14px;color:#4a5568">Đơn hàng <strong>${order_code || ''}</strong> đang được giao đến bạn.</p>
            <p style="font-size:14px;color:#4a5568">Sản phẩm: <strong>${product_name}</strong></p>
            <p style="font-size:14px;color:#718096;margin-top:20px">Trân trọng,<br /><strong>${storeName}</strong></p>
          </div>
        </div>`
    }

    // Send email
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: settings.order_email_sender,
        pass: settings.order_email_app_password,
      },
    })

    await transporter.sendMail({
      from: `"${storeName}" <${settings.order_email_sender}>`,
      to: customer_email,
      subject,
      html: htmlContent,
    })

    // Log success
    await supabaseAdmin
      .from('landing_order_email_logs')
      .insert({
        tenant_id,
        order_id,
        email_type,
        recipient_email: customer_email,
        status: 'sent',
      })

    console.log(`Order email (${email_type}) sent to ${customer_email} for order ${order_id}`)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending order email:', error)

    // Try to log the error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const body = await req.clone().json().catch(() => ({}))
      if (body.tenant_id && body.order_id) {
        await supabaseAdmin
          .from('landing_order_email_logs')
          .insert({
            tenant_id: body.tenant_id,
            order_id: body.order_id,
            email_type: body.email_type || 'order_confirmation',
            recipient_email: body.customer_email || 'unknown',
            status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
          })
      }
    } catch {}

    return new Response(
      JSON.stringify({ success: false, error: 'Email sending failed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
