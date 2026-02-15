import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendExtensionEmails(recipients: { email: string; name: string; newEndDate: string; daysAdded: number }[], customNote?: string) {
  const smtpUser = Deno.env.get('SMTP_USER')
  const smtpPassword = Deno.env.get('SMTP_PASSWORD')
  if (!smtpUser || !smtpPassword) return

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPassword },
  })

  const BATCH_SIZE = 5
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(batch.map(r => {
      const endDateStr = new Date(r.newEndDate).toLocaleDateString('vi-VN')
      const noteHtml = customNote ? `<p style="margin:12px 0;color:#374151;font-size:14px"><em>📝 ${customNote}</em></p>` : ''
      const html = [
        '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden">',
          '<div style="background:linear-gradient(135deg,#1a56db,#2563eb);color:#fff;padding:24px;text-align:center">',
            '<h1 style="margin:0;font-size:20px;font-weight:bold">🎉 Tặng thêm ngày sử dụng</h1>',
          '</div>',
          '<div style="background:#fff;padding:24px">',
            `<p style="margin:0 0 12px;color:#374151;font-size:15px">Xin chào <strong>${r.name}</strong>,</p>`,
            `<p style="margin:0 0 12px;color:#374151;font-size:15px">Tài khoản VKHO của bạn vừa được <strong>tặng thêm ${r.daysAdded} ngày</strong> sử dụng! 🎊</p>`,
            `<div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px;border-radius:0 8px 8px 0;margin:16px 0">`,
              `<p style="margin:0;font-size:14px;color:#1e40af"><strong>Hạn sử dụng mới:</strong> ${endDateStr}</p>`,
            '</div>',
            noteHtml,
            '<p style="margin:16px 0 0;color:#374151;font-size:14px">Cảm ơn bạn đã sử dụng VKHO! 💙</p>',
          '</div>',
          '<div style="background:#f3f4f6;padding:16px 24px;text-align:center">',
            '<p style="margin:0;font-size:12px;color:#9ca3af">© 2025 VKHO – Hệ thống quản lý kho hàng thông minh</p>',
          '</div>',
        '</div>',
      ].join('')

      return transporter.sendMail({
        from: `"VKHO" <${smtpUser}>`,
        to: r.email,
        subject: `🎉 Tặng thêm ${r.daysAdded} ngày sử dụng VKHO`,
        html,
      })
    }))
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const supabaseUrlRL = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKeyRL = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const rlClient = createClient(supabaseUrlRL, supabaseServiceKeyRL, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: allowed } = await rlClient.rpc('check_rate_limit', { _function_name: 'manage-tenant', _ip_address: clientIP, _max_requests: 20, _window_minutes: 60 })
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

    const { action, tenantId, tenantIds, reason, days, note } = await req.json()

    // ========== BULK EXTEND ==========
    if (action === 'bulk_extend') {
      if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Thiếu danh sách doanh nghiệp' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (!days || days < 1) {
        return new Response(
          JSON.stringify({ error: 'Số ngày gia hạn không hợp lệ' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: tenantsToExtend } = await supabaseAdmin
        .from('tenants')
        .select('id, name, email, status, subscription_plan, subscription_end_date, trial_end_date')
        .in('id', tenantIds)

      if (!tenantsToExtend || tenantsToExtend.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Không tìm thấy doanh nghiệp' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const now = new Date()
      let successCount = 0
      let failCount = 0
      const emailsToSend: { email: string; name: string; newEndDate: string; daysAdded: number }[] = []

      for (const t of tenantsToExtend) {
        try {
          const currentEndDate = t.subscription_end_date 
            ? new Date(t.subscription_end_date)
            : (t.trial_end_date ? new Date(t.trial_end_date) : now)
          const baseDate = currentEndDate > now ? currentEndDate : now
          const newEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)

          const updateData: Record<string, unknown> = {}
          if (t.subscription_plan) {
            updateData.subscription_end_date = newEndDate.toISOString()
          } else {
            updateData.trial_end_date = newEndDate.toISOString()
          }
          if (t.status === 'expired') {
            updateData.status = t.subscription_plan ? 'active' : 'trial'
          }

          await supabaseAdmin.from('tenants').update(updateData).eq('id', t.id)
          await supabaseAdmin.from('subscription_history').insert({
            tenant_id: t.id,
            action: 'extension',
            old_status: t.status,
            new_status: updateData.status || t.status,
            old_end_date: currentEndDate.toISOString(),
            new_end_date: newEndDate.toISOString(),
            days_added: days,
            performed_by: caller.id,
            note: note || `Tặng thêm ${days} ngày sử dụng`,
          })

          successCount++
          if (t.email) {
            emailsToSend.push({ email: t.email, name: t.name, newEndDate: newEndDate.toISOString(), daysAdded: days })
          }
        } catch (err) {
          console.error(`Failed to extend tenant ${t.id}:`, err)
          failCount++
        }
      }

      // Send notification emails
      if (emailsToSend.length > 0) {
        try {
          await sendExtensionEmails(emailsToSend, note)
        } catch (err) {
          console.error('Failed to send extension emails:', err)
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: `Đã gia hạn ${successCount} DN thành công${failCount > 0 ? `, ${failCount} thất bại` : ''}`, successCount, failCount }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== SINGLE TENANT ACTIONS ==========
    if (!tenantId || !action) {
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy doanh nghiệp' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      case 'lock': {
        await supabaseAdmin
          .from('tenants')
          .update({
            status: 'locked',
            locked_at: new Date().toISOString(),
            locked_reason: reason || 'Bị khóa bởi quản trị viên',
          })
          .eq('id', tenantId)

        await supabaseAdmin
          .from('subscription_history')
          .insert({
            tenant_id: tenantId,
            action: 'locked',
            old_status: tenant.status,
            new_status: 'locked',
            performed_by: caller.id,
            note: reason || 'Khóa tài khoản',
          })

        return new Response(
          JSON.stringify({ success: true, message: 'Đã khóa doanh nghiệp' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'unlock': {
        await supabaseAdmin
          .from('tenants')
          .update({
            status: tenant.subscription_end_date && new Date(tenant.subscription_end_date) > new Date() 
              ? 'active' 
              : (tenant.trial_end_date && new Date(tenant.trial_end_date) > new Date() ? 'trial' : 'expired'),
            locked_at: null,
            locked_reason: null,
          })
          .eq('id', tenantId)

        await supabaseAdmin
          .from('subscription_history')
          .insert({
            tenant_id: tenantId,
            action: 'unlocked',
            old_status: 'locked',
            new_status: 'active',
            performed_by: caller.id,
            note: note || 'Mở khóa tài khoản',
          })

        return new Response(
          JSON.stringify({ success: true, message: 'Đã mở khóa doanh nghiệp' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'extend': {
        if (!days || days < 1) {
          return new Response(
            JSON.stringify({ error: 'Số ngày gia hạn không hợp lệ' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const now = new Date()
        const currentEndDate = tenant.subscription_end_date 
          ? new Date(tenant.subscription_end_date)
          : (tenant.trial_end_date ? new Date(tenant.trial_end_date) : now)
        
        const baseDate = currentEndDate > now ? currentEndDate : now
        const newEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)

        const updateData: Record<string, unknown> = {}
        
        if (tenant.subscription_plan) {
          updateData.subscription_end_date = newEndDate.toISOString()
        } else {
          updateData.trial_end_date = newEndDate.toISOString()
        }

        if (tenant.status === 'expired') {
          updateData.status = tenant.subscription_plan ? 'active' : 'trial'
        }

        await supabaseAdmin
          .from('tenants')
          .update(updateData)
          .eq('id', tenantId)

        await supabaseAdmin
          .from('subscription_history')
          .insert({
            tenant_id: tenantId,
            action: 'extension',
            old_status: tenant.status,
            new_status: updateData.status || tenant.status,
            old_end_date: currentEndDate.toISOString(),
            new_end_date: newEndDate.toISOString(),
            days_added: days,
            performed_by: caller.id,
            note: note || `Gia hạn ${days} ngày`,
          })

        // Send email notification for single extend too
        if (tenant.email) {
          try {
            await sendExtensionEmails([{
              email: tenant.email,
              name: tenant.name,
              newEndDate: newEndDate.toISOString(),
              daysAdded: days,
            }], note)
          } catch (err) {
            console.error('Failed to send extension email:', err)
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Đã gia hạn ${days} ngày`,
            newEndDate: newEndDate.toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'set_expired': {
        await supabaseAdmin
          .from('tenants')
          .update({ status: 'expired' })
          .eq('id', tenantId)

        await supabaseAdmin
          .from('subscription_history')
          .insert({
            tenant_id: tenantId,
            action: 'expired',
            old_status: tenant.status,
            new_status: 'expired',
            performed_by: caller.id,
            note: note || 'Hết hạn sử dụng',
          })

        return new Response(
          JSON.stringify({ success: true, message: 'Đã đặt trạng thái hết hạn' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Hành động không hợp lệ' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Lỗi hệ thống' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})