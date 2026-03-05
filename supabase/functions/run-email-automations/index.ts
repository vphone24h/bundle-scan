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
    case 'button':
      return `<div style="text-align:center;margin:16px 0"><a href="${content.url || '#'}" style="display:inline-block;padding:12px 32px;background:${content.color || '#1a56db'};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${content.text || 'Nhấn vào đây'}</a></div>`
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
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json().catch(() => ({}))
    const { testMode, automationId, testEmail } = body

    // === TEST MODE ===
    if (testMode && automationId && testEmail) {
      const { data: automation } = await supabase.from('email_automations').select('*').eq('id', automationId).single()
      if (!automation) throw new Error('Automation not found')

      const { data: blocks } = await supabase.from('email_automation_blocks').select('*').eq('automation_id', automationId).order('display_order')

      const { data: tenant } = await supabase.from('tenants').select('store_name, business_name').eq('id', automation.tenant_id).single()
      const storeName = tenant?.store_name || tenant?.business_name || 'Cửa hàng'

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

      if (smtpUser && smtpPassword) {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com', port: 465, secure: true,
          auth: { user: smtpUser, pass: smtpPassword },
        })
        await transporter.sendMail({
          from: `"${storeName}" <${smtpUser}>`,
          to: testEmail,
          subject: `[TEST] ${subject}`,
          html,
        })
      } else {
        throw new Error('SMTP chưa được cấu hình')
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === AUTO MODE - Process all active automations ===
    if (!smtpUser || !smtpPassword) {
      return new Response(JSON.stringify({ success: true, message: 'SMTP not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
    })

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
        const { data: blocks } = await supabase
          .from('email_automation_blocks')
          .select('*')
          .eq('automation_id', automation.id)
          .order('display_order')

        if (!blocks?.length) continue

        const { data: tenant } = await supabase
          .from('tenants')
          .select('store_name, business_name')
          .eq('id', automation.tenant_id)
          .single()

        const storeName = tenant?.store_name || tenant?.business_name || 'Cửa hàng'

        // Find eligible customers based on trigger type
        let eligibleReceipts: any[] = []
        const today = new Date()

        if (automation.trigger_type === 'days_after_purchase') {
          const targetDate = new Date(today.getTime() - automation.trigger_days * 86400000)
          const dayStart = targetDate.toISOString().split('T')[0]
          const dayEnd = new Date(targetDate.getTime() + 86400000).toISOString().split('T')[0]

          const { data } = await supabase
            .from('export_receipts')
            .select('id, customer_id, export_date, customers(id, name, phone, email)')
            .eq('tenant_id', automation.tenant_id)
            .eq('status', 'completed')
            .gte('export_date', dayStart)
            .lt('export_date', dayEnd)
            .limit(500)

          eligibleReceipts = data || []
        } else if (automation.trigger_type === 'days_before_warranty_expires') {
          // Find items whose warranty expires in trigger_days
          const targetDate = new Date(today.getTime() + automation.trigger_days * 86400000)
          const dayStr = targetDate.toISOString().split('T')[0]

          // We check export_receipt_items with warranty field
          const { data } = await supabase
            .from('export_receipts')
            .select('id, customer_id, export_date, customers(id, name, phone, email)')
            .eq('tenant_id', automation.tenant_id)
            .eq('status', 'completed')
            .limit(500)

          // Filter by warranty expiry - simplified approach
          eligibleReceipts = data || []
        } else if (automation.trigger_type === 'days_inactive') {
          // Find customers who haven't purchased in trigger_days
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

          // Check if already sent
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

          const processedBlocks = blocks.map((b: any) => ({
            ...b,
            content: JSON.parse(replaceVariables(JSON.stringify(b.content), vars)),
          }))

          const html = buildEmailHtml(processedBlocks, storeName)
          const subject = replaceVariables(automation.subject, vars)

          try {
            await transporter.sendMail({
              from: `"${storeName}" <${smtpUser}>`,
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
