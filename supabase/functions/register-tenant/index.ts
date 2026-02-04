import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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