import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function renderBlock(block: any, vars: Record<string, string>): string {
  const replaceVars = (text: string) => {
    let result = text
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value || '')
    }
    return result
  }

  const { block_type } = block
  const content = JSON.parse(replaceVars(JSON.stringify(block.content)))

  switch (block_type) {
    case 'heading': {
      const tag = content.level || 'h2'
      const size = tag === 'h1' ? '24px' : tag === 'h2' ? '20px' : '16px'
      return `<${tag} style="margin:12px 0 8px;font-size:${size};font-weight:700;color:#1f2937">${content.text || ''}</${tag}>`
    }
    case 'text':
      return `<p style="margin:8px 0;font-size:15px;line-height:1.7;color:#374151">${(content.text || '').replace(/\n/g, '<br>')}</p>`
    case 'image':
      return content.url ? `<div style="margin:12px 0;text-align:center"><img src="${content.url}" alt="${content.alt || ''}" style="max-width:100%;border-radius:8px" /></div>` : ''
    case 'button': {
      const btnUrl = content.url || '#'
      if (btnUrl.startsWith('tel:')) {
        const phone = btnUrl.replace('tel:', '').trim()
        return `<div style="text-align:center;margin:16px 0"><a href="${btnUrl}" style="display:inline-block;padding:12px 32px;background:${content.color || '#1a56db'};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${content.text || 'Nhấn vào đây'}</a><br/><a href="${btnUrl}" style="display:inline-block;margin-top:6px;font-size:16px;color:${content.color || '#1a56db'};font-weight:700;text-decoration:none;letter-spacing:0.5px">${phone}</a></div>`
      }
      if (btnUrl.startsWith('mailto:')) {
        const email = btnUrl.replace('mailto:', '').trim()
        return `<div style="text-align:center;margin:16px 0"><a href="${btnUrl}" style="display:inline-block;padding:12px 32px;background:${content.color || '#1a56db'};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${content.text || 'Nhấn vào đây'}</a><br/><a href="${btnUrl}" style="display:inline-block;margin-top:6px;font-size:15px;color:${content.color || '#1a56db'};font-weight:600;text-decoration:none">${email}</a></div>`
      }
      return `<div style="text-align:center;margin:16px 0"><a href="${btnUrl}" style="display:inline-block;padding:12px 32px;background:${content.color || '#1a56db'};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${content.text || 'Nhấn vào đây'}</a></div>`
    }
    case 'link':
      return `<p style="margin:8px 0;font-size:15px;line-height:1.7;color:#374151">${content.text || ''} <a href="${content.url || '#'}" style="color:#1a56db;text-decoration:underline;font-weight:500">${content.linkText || content.url || 'Link'}</a></p>`
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />`
    case 'spacer':
      return `<div style="height:${content.height || 20}px"></div>`
    default:
      return ''
  }
}

function buildCustomEmailHtml(blocks: any[], storeName: string, vars: Record<string, string>): string {
  const bodyContent = blocks.sort((a: any, b: any) => a.display_order - b.display_order).map(b => renderBlock(b, vars)).join('\n')

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr><td style="padding:32px 32px 24px">
          ${bodyContent}
        </td></tr>
        <tr><td style="background:#1e3a8a;padding:16px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#93c5fd">© ${new Date().getFullYear()} ${storeName}</p>
        </td></tr>
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

    // Map email_type to trigger_type for custom templates
    const triggerTypeMap: Record<string, string> = {
      'order_confirmation': 'on_order_confirmation',
      'order_confirmed': 'on_order_confirmed',
      'order_shipping': 'on_order_shipping',
      'order_warranty': 'on_order_warranty',
      'booking_confirmation': 'on_booking_confirmation',
      'booking_consult': 'on_booking_consult',
      'booking_beauty': 'on_booking_beauty',
      'food_order': 'on_food_order',
      'table_booking': 'on_table_booking',
      'delivery': 'on_delivery',
      'quote_request': 'on_quote_request',
    }

    const triggerType = triggerTypeMap[email_type]
    let subject = ''
    let htmlContent = ''
    let useCustomTemplate = false

    // Check for custom template in email_automations
    if (triggerType) {
      const { data: automation } = await supabaseAdmin
        .from('email_automations')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('trigger_type', triggerType)
        .eq('is_active', true)
        .single()

      if (automation) {
        const { data: blocks } = await supabaseAdmin
          .from('email_automation_blocks')
          .select('*')
          .eq('automation_id', automation.id)
          .order('display_order')

        if (blocks?.length) {
          const vars: Record<string, string> = {
            '{{customer_name}}': customer_name || 'Quý khách',
            '{{product_name}}': product_name || '',
            '{{product_price}}': formatPrice(product_price || 0),
            '{{purchase_date}}': new Date().toLocaleDateString('vi-VN'),
            '{{order_code}}': order_code || '',
            '{{store_name}}': storeName,
            '{{phone}}': storePhone,
            '{{address}}': storeAddress,
          }

          const replaceVars = (text: string) => {
            let result = text
            for (const [key, value] of Object.entries(vars)) {
              result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value || '')
            }
            return result
          }

          subject = replaceVars(automation.subject)
          htmlContent = buildCustomEmailHtml(blocks, storeName, vars)
          useCustomTemplate = true
        }
      }
    }

    // Fallback to default templates
    if (!useCustomTemplate) {
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