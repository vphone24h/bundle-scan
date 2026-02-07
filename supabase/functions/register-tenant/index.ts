import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { encode as base64Encode } from 'https://deno.land/std@0.190.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function encodeSubject(subject: string): string {
  const encoded = base64Encode(new TextEncoder().encode(subject))
  return `=?UTF-8?B?${encoded}?=`
}

async function sendRegistrationNotification(businessName: string, subdomain: string, email: string, adminName: string) {
  try {
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')

    if (!smtpUser || !smtpPassword) {
      console.error('SMTP credentials not configured')
      return
    }

    const now = new Date()
    const dateStr = now.toLocaleDateString('vi-VN', { 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
    })

    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    })

    const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb;border-radius:8px"><div style="background:#1a56db;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center"><h1 style="margin:0;font-size:20px">🎉 Đăng ký tài khoản mới - VKHO</h1></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px"><p style="font-size:16px;color:#374151;margin-bottom:16px">Có tài khoản doanh nghiệp mới vừa đăng ký trên hệ thống VKHO:</p><table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid #e5e7eb"><td style="padding:10px 12px;color:#6b7280;font-weight:600;width:140px">Tên công ty</td><td style="padding:10px 12px;color:#111827;font-weight:bold">${businessName}</td></tr><tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb"><td style="padding:10px 12px;color:#6b7280;font-weight:600">Tên ID (subdomain)</td><td style="padding:10px 12px;color:#111827;font-weight:bold">${subdomain}</td></tr><tr style="border-bottom:1px solid #e5e7eb"><td style="padding:10px 12px;color:#6b7280;font-weight:600">Người đăng ký</td><td style="padding:10px 12px;color:#111827">${adminName}</td></tr><tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb"><td style="padding:10px 12px;color:#6b7280;font-weight:600">Gmail</td><td style="padding:10px 12px;color:#1a56db">${email}</td></tr><tr><td style="padding:10px 12px;color:#6b7280;font-weight:600">Ngày đăng ký</td><td style="padding:10px 12px;color:#111827">${dateStr}</td></tr></table><div style="margin-top:20px;padding:12px;background:#ecfdf5;border-radius:6px;text-align:center;color:#065f46;font-weight:600">✅ Tài khoản đã được tạo thành công</div></div></div>`

    await client.send({
      from: smtpUser,
      to: 'vphone24h@gmail.com',
      subject: encodeSubject(`[VKHO] Dang ky moi: ${businessName} (${subdomain})`),
      content: 'auto',
      html: htmlContent,
    })

    await client.close()
    console.log('Registration notification email sent successfully')
  } catch (error) {
    console.error('Failed to send registration notification email:', error)
    // Don't throw - email failure should not block registration
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { 
      businessName, 
      subdomain, 
      adminName, 
      email, 
      password, 
      phone 
    } = await req.json()

    // Validate required fields
    if (!businessName || !subdomain || !adminName || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate subdomain format (lowercase, alphanumeric, hyphens)
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/
    if (!subdomainRegex.test(subdomain.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Tên miền phụ không hợp lệ (3-32 ký tự, chỉ chữ thường, số và dấu gạch ngang)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if subdomain already exists
    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('subdomain', subdomain.toLowerCase())
      .maybeSingle()

    if (existingTenant) {
      return new Response(
        JSON.stringify({ error: 'Tên miền phụ đã được sử dụng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('platform_users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email đã được sử dụng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const { data: existingPhone } = await supabaseAdmin
        .from('platform_users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (existingPhone) {
        return new Response(
          JSON.stringify({ error: 'Số điện thoại đã được sử dụng' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Also check in tenants table
      const { data: existingTenantPhone } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (existingTenantPhone) {
        return new Response(
          JSON.stringify({ error: 'Số điện thoại đã được sử dụng' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create user account
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: adminName,
      },
    })

    if (createError) {
      console.error('Create user error:', createError)
      // Translate Supabase Auth errors to Vietnamese
      let errorMessage = createError.message
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        errorMessage = 'Email này đã được sử dụng'
      } else if (createError.message.includes('invalid email')) {
        errorMessage = 'Định dạng email không hợp lệ'
      } else if (createError.message.includes('password')) {
        errorMessage = 'Mật khẩu phải có ít nhất 6 ký tự'
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: businessName,
        subdomain: subdomain.toLowerCase(),
        owner_id: newUser.user.id,
        status: 'trial',
        phone,
        email,
      })
      .select()
      .single()

    if (tenantError) {
      // Rollback: delete the user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      console.error('Create tenant error:', tenantError)
      return new Response(
        JSON.stringify({ error: 'Không thể tạo doanh nghiệp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create platform user record
    const { error: platformUserError } = await supabaseAdmin
      .from('platform_users')
      .insert({
        user_id: newUser.user.id,
        tenant_id: tenant.id,
        platform_role: 'tenant_admin',
        display_name: adminName,
        phone,
        email,
      })

    if (platformUserError) {
      console.error('Platform user error:', platformUserError)
    }

    // Update profiles with tenant_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ tenant_id: tenant.id })
      .eq('user_id', newUser.user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
    }

    // Create default branch for tenant
    const { data: defaultBranch, error: branchError } = await supabaseAdmin
      .from('branches')
      .insert({
        name: 'Chi nhánh chính',
        tenant_id: tenant.id,
        is_default: true,
      })
      .select()
      .single()

    if (branchError) {
      console.error('Branch create error:', branchError)
    }

    // Update user_roles with tenant_id and branch_id
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .update({ 
        tenant_id: tenant.id,
        branch_id: defaultBranch?.id,
        user_role: 'super_admin'
      })
      .eq('user_id', newUser.user.id)

    if (roleError) {
      console.error('Role update error:', roleError)
    }

    // Create subscription history entry
    await supabaseAdmin
      .from('subscription_history')
      .insert({
        tenant_id: tenant.id,
        action: 'trial_start',
        new_status: 'trial',
        new_end_date: tenant.trial_end_date,
        note: 'Bắt đầu dùng thử 30 ngày',
      })

    // Create default point settings for tenant
    await supabaseAdmin
      .from('point_settings')
      .insert({ tenant_id: tenant.id })

    // Create default membership tier settings
    await supabaseAdmin
      .from('membership_tier_settings')
      .insert([
        { tenant_id: tenant.id, tier: 'regular', min_spent: 0, points_multiplier: 1 },
        { tenant_id: tenant.id, tier: 'silver', min_spent: 5000000, points_multiplier: 1.2 },
        { tenant_id: tenant.id, tier: 'gold', min_spent: 20000000, points_multiplier: 1.5 },
        { tenant_id: tenant.id, tier: 'vip', min_spent: 50000000, points_multiplier: 2 },
      ])

    // Send notification email to admin (non-blocking)
    sendRegistrationNotification(businessName, subdomain.toLowerCase(), email, adminName)
      .catch(err => console.error('Email notification error:', err))

    return new Response(
      JSON.stringify({ 
        success: true, 
        tenant: {
          id: tenant.id,
          subdomain: tenant.subdomain,
          trialEndDate: tenant.trial_end_date,
        },
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Lỗi hệ thống' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})