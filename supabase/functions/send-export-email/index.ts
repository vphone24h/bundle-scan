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
      customer_name,
      customer_email,
      customer_phone,
      items,
      total_amount,
      receipt_code,
      branch_id,
      export_date,
      sales_staff_id,
      order_id,
    } = await req.json()

    if (!tenant_id || !customer_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tenant landing settings for email config & store info
    const { data: settings } = await supabaseAdmin
      .from('tenant_landing_settings')
      .select('order_email_enabled, order_email_sender, order_email_app_password, store_name, store_phone, store_address, store_email, facebook_url, zalo_url, include_staff_in_email, include_rating_in_email')
      .eq('tenant_id', tenant_id)
      .single()

    if (!settings?.order_email_enabled || !settings?.order_email_sender || !settings?.order_email_app_password) {
      console.log('Export email not configured or disabled for tenant:', tenant_id)
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Email not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tenant subdomain for website link
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('subdomain')
      .eq('id', tenant_id)
      .single()

    // Get custom domain if available
    const { data: customDomain } = await supabaseAdmin
      .from('custom_domains')
      .select('domain')
      .eq('tenant_id', tenant_id)
      .eq('is_verified', true)
      .limit(1)
      .maybeSingle()

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

    // Get sales staff name - always show if available
    let staffName = ''
    const showStaff = true
    const showRating = true
    if (sales_staff_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('display_name')
        .eq('user_id', sales_staff_id)
        .single()
      if (profile?.display_name) {
        staffName = profile.display_name
      }
    }

    const storeName = settings.store_name || 'Cửa hàng'
    const storePhone = branchPhone || settings.store_phone || ''
    const storeAddress = branchAddress || settings.store_address || ''
    const storeEmail = settings.store_email || ''
    const websiteUrl = customDomain?.domain
      ? `https://${customDomain.domain}`
      : tenant?.subdomain
        ? `https://${tenant.subdomain}.vkho.vn`
        : ''

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('vi-VN').format(price) + 'đ'
    }

    const formatDate = (dateStr: string) => {
      try {
        const d = new Date(dateStr)
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      } catch {
        return dateStr
      }
    }

    const isUuid = (value: string | undefined | null) =>
      !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

    // landing_order_email_logs requires order_id UUID (for export flow, use receipt/order UUID)
    const resolvedOrderId = isUuid(order_id) ? order_id! : crypto.randomUUID()

    // Build warranty check URL for rating - use first IMEI if available
    const firstImei = (items || []).find((item: any) => item.imei)?.imei || ''
    const warrantyCheckUrl = websiteUrl && firstImei
      ? `${websiteUrl}/warranty-check?imei=${encodeURIComponent(firstImei)}`
      : ''

    // Build items table rows
    const itemRows = (items || []).map((item: any, idx: number) => `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 8px;font-size:14px;color:#2d3748">${idx + 1}</td>
        <td style="padding:10px 8px;font-size:14px;color:#2d3748">
          <strong>${item.product_name}</strong>
          ${item.imei ? `<br/><span style="font-size:12px;color:#718096">IMEI: ${item.imei}</span>` : ''}
        </td>
        <td style="padding:10px 8px;font-size:14px;color:#2d3748;text-align:center">${item.quantity || 1}</td>
        <td style="padding:10px 8px;font-size:14px;color:#2d3748;text-align:right">${formatPrice(item.sale_price)}</td>
        <td style="padding:10px 8px;font-size:14px;color:#718096;text-align:center">${item.warranty || 'N/A'}</td>
      </tr>
    `).join('')

    // Build staff section HTML (conditional on settings)
    let staffSectionHtml = ''
    if (staffName && showStaff) {
      staffSectionHtml = `
      <!-- Sales Staff Info -->
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:16px;margin:0 0 24px">
        <div style="display:flex;align-items:center;margin-bottom:${showRating && warrantyCheckUrl ? '8px' : '0'}">
          <div style="width:40px;height:40px;border-radius:50%;background:#6366f1;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;margin-right:12px;line-height:40px;text-align:center">
            ${staffName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style="margin:0;font-size:12px;color:#6366f1;font-weight:500">Nhân viên tư vấn</p>
            <p style="margin:2px 0 0;font-size:16px;color:#312e81;font-weight:700">${staffName}</p>
          </div>
        </div>
        ${showRating && warrantyCheckUrl ? `
          <p style="margin:8px 0 0;font-size:13px;color:#4338ca;line-height:1.5">
            Bạn hài lòng với dịch vụ? Hãy dành 30 giây đánh giá nhân viên để giúp chúng tôi phục vụ bạn tốt hơn!
          </p>
          <div style="text-align:center;margin-top:12px">
            <a href="${warrantyCheckUrl}" style="display:inline-block;padding:10px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">⭐ Đánh giá nhân viên</a>
          </div>
        ` : ''}
      </div>`
    } else if (showRating && warrantyCheckUrl) {
      // Rating only without staff info
      staffSectionHtml = `
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:16px;margin:0 0 24px;text-align:center">
        <p style="margin:0 0 8px;font-size:14px;color:#4338ca;line-height:1.5">
          Bạn hài lòng với dịch vụ? Hãy dành 30 giây đánh giá để giúp chúng tôi phục vụ bạn tốt hơn!
        </p>
        <a href="${warrantyCheckUrl}" style="display:inline-block;padding:10px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">⭐ Đánh giá dịch vụ</a>
      </div>`
    }

    const subject = `Cảm ơn bạn đã mua hàng tại ${storeName}!`

    const htmlContent = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:#fff;padding:32px 24px;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px">🎉 Cảm ơn bạn đã mua hàng!</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#a0c4ff">${storeName}</p>
        </div>

        <div style="padding:28px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          <!-- Greeting -->
          <p style="font-size:16px;color:#2d3748;margin:0 0 20px">
            Xin chào <strong>${customer_name || 'Quý khách'}</strong>,
          </p>
          <p style="font-size:14px;color:#4a5568;margin:0 0 24px;line-height:1.6">
            Chúng tôi xin chân thành cảm ơn bạn đã tin tưởng và mua sắm tại <strong>${storeName}</strong>. 
            Dưới đây là chi tiết đơn hàng của bạn:
          </p>

          <!-- Order info -->
          <div style="background:#f0f4ff;border:1px solid #c3d4ff;border-radius:10px;padding:16px;margin:0 0 24px">
            <table style="width:100%">
              ${receipt_code ? `<tr>
                <td style="padding:4px 0;font-size:14px;color:#718096">Mã đơn hàng:</td>
                <td style="padding:4px 0;font-size:14px;color:#2d3748;font-weight:700;text-align:right;font-family:monospace">${receipt_code}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#718096">Ngày mua:</td>
                <td style="padding:4px 0;font-size:14px;color:#2d3748;text-align:right">${formatDate(export_date || new Date().toISOString())}</td>
              </tr>
              ${branchName ? `<tr>
                <td style="padding:4px 0;font-size:14px;color:#718096">Chi nhánh:</td>
                <td style="padding:4px 0;font-size:14px;color:#2d3748;text-align:right">${branchName}</td>
              </tr>` : ''}
              ${staffName && showStaff ? `<tr>
                <td style="padding:4px 0;font-size:14px;color:#718096">Nhân viên tư vấn:</td>
                <td style="padding:4px 0;font-size:14px;color:#4338ca;font-weight:600;text-align:right">${staffName}</td>
              </tr>` : ''}
            </table>
          </div>

          <!-- Items table -->
          <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
            <thead>
              <tr style="background:#f7fafc;border-bottom:2px solid #e2e8f0">
                <th style="padding:10px 8px;font-size:13px;color:#718096;text-align:left;text-transform:uppercase;letter-spacing:0.5px">#</th>
                <th style="padding:10px 8px;font-size:13px;color:#718096;text-align:left;text-transform:uppercase;letter-spacing:0.5px">Sản phẩm</th>
                <th style="padding:10px 8px;font-size:13px;color:#718096;text-align:center;text-transform:uppercase;letter-spacing:0.5px">SL</th>
                <th style="padding:10px 8px;font-size:13px;color:#718096;text-align:right;text-transform:uppercase;letter-spacing:0.5px">Giá</th>
                <th style="padding:10px 8px;font-size:13px;color:#718096;text-align:center;text-transform:uppercase;letter-spacing:0.5px">Bảo hành</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid #2d3748">
                <td colspan="3" style="padding:12px 8px;font-size:16px;font-weight:700;color:#2d3748">Tổng cộng</td>
                <td colspan="2" style="padding:12px 8px;font-size:20px;font-weight:700;color:#e53e3e;text-align:right">${formatPrice(total_amount)}</td>
              </tr>
            </tfoot>
          </table>

          ${staffSectionHtml}

          <!-- Warranty notice -->
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:16px;margin:0 0 24px">
            <h3 style="margin:0 0 8px;font-size:15px;color:#92400e;font-weight:700">🛡️ Thông tin bảo hành</h3>
            <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6">
              Sản phẩm của bạn được bảo hành theo chính sách của ${storeName}. 
              Vui lòng giữ email này hoặc hóa đơn mua hàng để sử dụng khi cần bảo hành.
              ${storePhone ? `<br/>Hotline hỗ trợ: <a href="tel:${storePhone}" style="color:#b45309;font-weight:700;text-decoration:none">${storePhone}</a>` : ''}
            </p>
          </div>

          <!-- Thank you message -->
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin:0 0 24px;text-align:center">
            <p style="margin:0;font-size:15px;color:#166534;line-height:1.6">
              💚 Cảm ơn bạn đã chọn <strong>${storeName}</strong>!<br/>
              Chúng tôi rất vui được phục vụ bạn và mong được gặp lại bạn trong tương lai.
            </p>
          </div>

          <!-- Contact & Website -->
          <div style="background:#f8fafc;border-radius:10px;padding:20px;margin:0 0 20px">
            <h3 style="margin:0 0 12px;font-size:15px;color:#334155;font-weight:700;text-align:center">📞 Liên hệ với chúng tôi</h3>
            ${branchName ? `<p style="margin:4px 0;font-size:14px;color:#475569;text-align:center"><strong>${branchName}</strong></p>` : ''}
            ${storePhone ? `<p style="margin:4px 0;font-size:14px;color:#475569;text-align:center">📱 Hotline: <a href="tel:${storePhone}" style="color:#2563eb;font-weight:600;text-decoration:none">${storePhone}</a></p>` : ''}
            ${storeAddress ? `<p style="margin:4px 0;font-size:14px;color:#64748b;text-align:center">📍 ${storeAddress}</p>` : ''}
            ${storeEmail ? `<p style="margin:4px 0;font-size:14px;color:#64748b;text-align:center">✉️ ${storeEmail}</p>` : ''}
            ${websiteUrl ? `<p style="margin:12px 0 4px;text-align:center"><a href="${websiteUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">🌐 Ghé thăm Website</a></p>` : ''}
            ${settings.facebook_url || settings.zalo_url ? `
              <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;text-align:center">
                ${settings.facebook_url ? `<a href="${settings.facebook_url}" style="color:#2563eb;text-decoration:none;margin:0 8px">Facebook</a>` : ''}
                ${settings.zalo_url ? `<a href="${settings.zalo_url}" style="color:#2563eb;text-decoration:none;margin:0 8px">Zalo</a>` : ''}
              </p>
            ` : ''}
          </div>

          <!-- Footer -->
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5">
            Email này được gửi tự động từ hệ thống ${storeName}.<br/>
            Vui lòng không trả lời trực tiếp email này.
          </p>
        </div>
      </div>`

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

    console.log(`Export email sent to ${customer_email} for receipt ${receipt_code}`)

    // Log to platform_email_automation_logs
    await supabaseAdmin.from('platform_email_automation_logs').insert({
      recipient_email: customer_email,
      recipient_name: customer_name || null,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      body_html: htmlContent,
      tenant_id: tenant_id || null,
      automation_id: null,
    }).then(({ error: logErr }) => {
      if (logErr) console.warn('Failed to log export email:', logErr.message)
    })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error sending export email:', error)

    // Log failure
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const sb = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      await sb.from('platform_email_automation_logs').insert({
        recipient_email: 'unknown',
        subject: 'export_email',
        status: 'failed',
        error_message: error.message,
        body_html: null,
        automation_id: null,
      })
    } catch {}

    return new Response(
      JSON.stringify({ success: false, error: 'Email sending failed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})