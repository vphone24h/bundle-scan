import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutomationBlock {
  block_type: string
  content: Record<string, any>
  display_order: number
}

function renderBlockToHtml(block: AutomationBlock): string {
  const { block_type, content } = block
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
      // tel: and mailto: links get blocked by Gmail's link proxy, so render them as styled text with the number/email visible
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
    case 'staff_info': {
      const label = content.label || 'Nhân viên tư vấn'
      const name = content._resolved_staff_name || '{{staff_name}}'
      return `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:16px;margin:12px 0">
        <div style="display:flex;align-items:center">
          <div style="width:40px;height:40px;border-radius:50%;background:#6366f1;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;margin-right:12px;line-height:40px;text-align:center">${name.charAt(0).toUpperCase()}</div>
          <div>
            <p style="margin:0;font-size:12px;color:#6366f1;font-weight:500">${label}</p>
            <p style="margin:2px 0 0;font-size:16px;color:#312e81;font-weight:700">${name}</p>
          </div>
        </div>
      </div>`
    }
    case 'rating_button': {
      const ratingUrl = content._resolved_rating_url || '#'
      const desc = content.description || ''
      const btnText = content.text || '⭐ Đánh giá'
      const btnColor = content.color || '#6366f1'
      return `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:16px;margin:12px 0;text-align:center">
        ${desc ? `<p style="margin:0 0 8px;font-size:13px;color:#4338ca;line-height:1.5">${desc}</p>` : ''}
        <a href="${ratingUrl}" style="display:inline-block;padding:10px 28px;background:${btnColor};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${btnText}</a>
      </div>`
    }
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />`
    case 'spacer':
      return `<div style="height:${content.height || 20}px"></div>`
    default:
      return ''
  }
}

function buildEmailHtml(blocks: AutomationBlock[], storeName: string): string {
  const bodyContent = blocks.sort((a, b) => a.display_order - b.display_order).map(renderBlockToHtml).join('\n')

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

function replaceVariables(text: string, vars: Record<string, string>): string {
  let result = text
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value || '')
  }
  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Helper: get per-tenant SMTP credentials
    async function getTenantSmtp(tenantId: string) {
      const { data } = await supabase
        .from('tenant_landing_settings')
        .select('order_email_sender, order_email_app_password, store_name')
        .eq('tenant_id', tenantId)
        .single()
      if (!data?.order_email_sender || !data?.order_email_app_password) return null
      return {
        user: data.order_email_sender,
        pass: data.order_email_app_password,
        storeName: data.store_name || 'Cửa hàng',
      }
    }

    const body = await req.json().catch(() => ({}))
    const { testMode, automationId, testEmail } = body

    // === TEST MODE ===
    if (testMode && automationId && testEmail) {
      const { data: automation } = await supabase.from('email_automations').select('*').eq('id', automationId).single()
      if (!automation) throw new Error('Automation not found')

      const { data: blocks } = await supabase.from('email_automation_blocks').select('*').eq('automation_id', automationId).order('display_order')

      const smtp = await getTenantSmtp(automation.tenant_id)
      if (!smtp) throw new Error('SMTP chưa được cấu hình cho cửa hàng này. Vui lòng cài đặt Email gửi (Gmail) trong Website bán hàng.')

      const { data: tenant } = await supabase.from('tenants').select('store_name, business_name').eq('id', automation.tenant_id).single()
      const storeName = tenant?.store_name || tenant?.business_name || smtp.storeName

      const vars: Record<string, string> = {
        '{{customer_name}}': 'Khách hàng test',
        '{{product_name}}': 'Sản phẩm mẫu',
        '{{purchase_date}}': new Date().toLocaleDateString('vi-VN'),
        '{{warranty_end}}': new Date(Date.now() + 365 * 86400000).toLocaleDateString('vi-VN'),
        '{{store_name}}': storeName,
      }

      const processedBlocks = (blocks || []).map((b: any) => ({
        ...b,
        content: JSON.parse(replaceVariables(JSON.stringify(b.content), vars)),
      }))

      const html = buildEmailHtml(processedBlocks, storeName)
      const subject = replaceVariables(automation.subject, vars)

      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: smtp.user, pass: smtp.pass },
      })
      await transporter.sendMail({
        from: `"${storeName}" <${smtp.user}>`,
        to: testEmail,
        subject: `[TEST] ${subject}`,
        html,
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === AUTO MODE - Process all active automations ===

    const { data: automations } = await supabase
      .from('email_automations')
      .select('*')
      .eq('is_active', true)

    if (!automations?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let totalSent = 0

    for (const automation of automations) {
      try {
        // Get per-tenant SMTP credentials
        const smtp = await getTenantSmtp(automation.tenant_id)
        if (!smtp) {
          console.log(`Tenant ${automation.tenant_id} has no SMTP configured, skipping`)
          continue
        }

        const { data: blocks } = await supabase
          .from('email_automation_blocks')
          .select('*')
          .eq('automation_id', automation.id)
          .order('display_order')

        if (!blocks?.length) continue

        const { data: tenant } = await supabase
          .from('tenants')
          .select('store_name, business_name, subdomain')
          .eq('id', automation.tenant_id)
          .single()

        const storeName = tenant?.store_name || tenant?.business_name || smtp.storeName

        // Get custom domain for rating URL
        const { data: customDomain } = await supabase
          .from('custom_domains')
          .select('domain')
          .eq('tenant_id', automation.tenant_id)
          .eq('is_verified', true)
          .limit(1)
          .maybeSingle()

        const websiteUrl = customDomain?.domain
          ? `https://${customDomain.domain}`
          : tenant?.subdomain
            ? `https://${tenant.subdomain}.vkho.vn`
            : ''

        // Check if blocks contain staff_info or rating_button
        const hasStaffBlock = blocks.some((b: any) => b.block_type === 'staff_info')
        const hasRatingBlock = blocks.some((b: any) => b.block_type === 'rating_button')

        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com', port: 465, secure: true,
          auth: { user: smtp.user, pass: smtp.pass },
        })

        // Find eligible customers based on trigger type
        let eligibleReceipts: any[] = []
        const today = new Date()

        if (automation.trigger_type === 'days_after_purchase') {
          const targetDate = new Date(today.getTime() - automation.trigger_days * 86400000)
          const dayStart = targetDate.toISOString().split('T')[0]
          const dayEnd = new Date(targetDate.getTime() + 86400000).toISOString().split('T')[0]

          const { data } = await supabase
            .from('export_receipts')
            .select('id, customer_id, export_date, sales_staff_id, customers(id, name, phone, email)')
            .eq('tenant_id', automation.tenant_id)
            .eq('status', 'completed')
            .gte('export_date', dayStart)
            .lt('export_date', dayEnd)
            .limit(500)

          eligibleReceipts = data || []
        } else if (automation.trigger_type === 'days_before_warranty_expires') {
          const targetDate = new Date(today.getTime() + automation.trigger_days * 86400000)

          const { data } = await supabase
            .from('export_receipts')
            .select('id, customer_id, export_date, sales_staff_id, customers(id, name, phone, email)')
            .eq('tenant_id', automation.tenant_id)
            .eq('status', 'completed')
            .limit(500)

          eligibleReceipts = data || []
        } else if (automation.trigger_type === 'days_inactive') {
          const cutoffDate = new Date(today.getTime() - automation.trigger_days * 86400000).toISOString()

          const { data: customers } = await supabase
            .from('customers')
            .select('id, name, phone, email')
            .eq('tenant_id', automation.tenant_id)
            .not('email', 'is', null)
            .lt('updated_at', cutoffDate)
            .limit(500)

          eligibleReceipts = (customers || []).map((c: any) => ({
            id: null,
            customer_id: c.id,
            customers: c,
          }))
        }

        for (const receipt of eligibleReceipts) {
          const customer = Array.isArray(receipt.customers) ? receipt.customers[0] : receipt.customers
          if (!customer?.email) continue

          const { count } = await supabase
            .from('email_automation_logs')
            .select('id', { count: 'exact', head: true })
            .eq('automation_id', automation.id)
            .eq('customer_id', customer.id)
            .eq('export_receipt_id', receipt.id || '00000000-0000-0000-0000-000000000000')

          if ((count || 0) > 0) continue

          const vars: Record<string, string> = {
            '{{customer_name}}': customer.name || 'Quý khách',
            '{{product_name}}': 'Sản phẩm',
            '{{purchase_date}}': receipt.export_date ? new Date(receipt.export_date).toLocaleDateString('vi-VN') : '',
            '{{warranty_end}}': '',
            '{{store_name}}': storeName,
          }

          // Resolve staff name for staff_info/rating_button blocks
          let staffName = ''
          if ((hasStaffBlock || hasRatingBlock) && receipt.sales_staff_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', receipt.sales_staff_id)
              .single()
            if (profile?.display_name) staffName = profile.display_name
          }

          // Get first IMEI for rating URL
          let ratingUrl = ''
          if (hasRatingBlock && websiteUrl && receipt.id) {
            const { data: items } = await supabase
              .from('export_receipt_items')
              .select('imei')
              .eq('export_receipt_id', receipt.id)
              .not('imei', 'is', null)
              .limit(1)
            const firstImei = items?.[0]?.imei
            if (firstImei) ratingUrl = `${websiteUrl}/warranty-check?imei=${encodeURIComponent(firstImei)}`
          }

          const processedBlocks = blocks.map((b: any) => {
            const processed = {
              ...b,
              content: JSON.parse(replaceVariables(JSON.stringify(b.content), vars)),
            }
            // Inject resolved data for special blocks
            if (b.block_type === 'staff_info' && staffName) {
              processed.content._resolved_staff_name = staffName
            }
            if (b.block_type === 'rating_button' && ratingUrl) {
              processed.content._resolved_rating_url = ratingUrl
            }
            return processed
          })

          const html = buildEmailHtml(processedBlocks, storeName)
          const subject = replaceVariables(automation.subject, vars)

          try {
            await transporter.sendMail({
              from: `"${storeName}" <${smtp.user}>`,
              to: customer.email,
              subject,
              html,
            })

            await supabase.from('email_automation_logs').insert({
              tenant_id: automation.tenant_id,
              automation_id: automation.id,
              customer_id: customer.id,
              customer_email: customer.email,
              customer_name: customer.name,
              export_receipt_id: receipt.id || null,
              subject,
              body_html: html,
              status: 'sent',
              sent_at: new Date().toISOString(),
            })

            totalSent++
          } catch (emailErr: any) {
            console.error('Email send error:', emailErr)
            await supabase.from('email_automation_logs').insert({
              tenant_id: automation.tenant_id,
              automation_id: automation.id,
              customer_id: customer.id,
              customer_email: customer.email,
              customer_name: customer.name,
              export_receipt_id: receipt.id || null,
              subject,
              status: 'failed',
              error_message: emailErr.message,
            })
          }
        }
      } catch (autoErr) {
        console.error(`Error processing automation ${automation.id}:`, autoErr)
      }
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('run-email-automations error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
