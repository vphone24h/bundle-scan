import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', { _function_name: 'update-user', _ip_address: clientIP, _max_requests: 30, _window_minutes: 60 })
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Không có quyền truy cập' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Không thể xác thực người dùng' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get caller's platform info (platform_role + company_id + tenant_id)
    const { data: callerPlatform } = await supabaseAdmin
      .from('platform_users')
      .select('tenant_id, company_id, platform_role')
      .eq('user_id', caller.id)
      .maybeSingle()

    const isPlatformAdmin = callerPlatform?.platform_role === 'platform_admin'
    const isCompanyAdmin = callerPlatform?.platform_role === 'company_admin'
    const callerTenantId = callerPlatform?.tenant_id
    const callerCompanyId = callerPlatform?.company_id

    // Check super_admin in user_roles (legacy) for backward compatibility
    let callerRoleQuery = supabaseAdmin
      .from('user_roles')
      .select('user_role')
      .eq('user_id', caller.id)

    if (callerTenantId) {
      callerRoleQuery = callerRoleQuery.eq('tenant_id', callerTenantId)
    }

    const { data: callerRole } = await callerRoleQuery.maybeSingle()
    const isSuperAdmin = callerRole?.user_role === 'super_admin'

    if (!isPlatformAdmin && !isCompanyAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Bạn không có quyền chỉnh sửa tài khoản' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { userId, email, password, displayName, phone } = body
    console.log('Update user request:', { userId, callerRole: callerPlatform?.platform_role, hasEmail: !!email, hasPassword: !!password })

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Thiếu thông tin người dùng' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Authorization scoping for company_admin: target user must belong to same company
    if (isCompanyAdmin && !isPlatformAdmin) {
      if (!callerCompanyId) {
        return new Response(JSON.stringify({ error: 'Không xác định được công ty của bạn' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Find target user's company through platform_users OR user_roles -> tenants -> company_id
      const { data: targetPlatform } = await supabaseAdmin
        .from('platform_users')
        .select('company_id, tenant_id, platform_role')
        .eq('user_id', userId)
        .maybeSingle()

      let targetCompanyId: string | null = targetPlatform?.company_id ?? null

      if (!targetCompanyId && targetPlatform?.tenant_id) {
        const { data: t } = await supabaseAdmin.from('tenants').select('company_id').eq('id', targetPlatform.tenant_id).maybeSingle()
        targetCompanyId = t?.company_id ?? null
      }

      if (!targetCompanyId) {
        const { data: targetRoles } = await supabaseAdmin
          .from('user_roles')
          .select('tenant_id')
          .eq('user_id', userId)
          .not('tenant_id', 'is', null)

        if (targetRoles && targetRoles.length > 0) {
          const tenantIds = targetRoles.map(r => r.tenant_id).filter(Boolean)
          const { data: tenants } = await supabaseAdmin.from('tenants').select('company_id').in('id', tenantIds)
          const match = tenants?.find(t => t.company_id === callerCompanyId)
          if (match) targetCompanyId = match.company_id
        }
      }

      if (targetCompanyId !== callerCompanyId) {
        return new Response(JSON.stringify({ error: 'Bạn chỉ có thể chỉnh sửa người dùng thuộc công ty của mình' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Block editing other platform_admin / company_admin (cannot edit peers / higher)
      if (targetPlatform?.platform_role === 'platform_admin' && userId !== caller.id) {
        return new Response(JSON.stringify({ error: 'Không thể chỉnh sửa tài khoản Admin Tổng' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // For super_admin (legacy): keep existing scoped check
    if (isSuperAdmin && !isPlatformAdmin && !isCompanyAdmin) {
      let targetRoleQuery = supabaseAdmin
        .from('user_roles')
        .select('user_role')
        .eq('user_id', userId)

      if (callerTenantId) {
        targetRoleQuery = targetRoleQuery.eq('tenant_id', callerTenantId)
      }

      const { data: targetRole } = await targetRoleQuery.maybeSingle()

      if (targetRole?.user_role === 'super_admin' && userId !== caller.id) {
        return new Response(JSON.stringify({ error: 'Không thể chỉnh sửa tài khoản Admin Tổng khác' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Update auth user (email/password)
    const authUpdates: { email?: string; password?: string } = {}
    if (email) authUpdates.email = email
    if (password) authUpdates.password = password

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates)
      if (authUpdateError) {
        console.error('Auth update error:', authUpdateError)
        const rawMsg = (authUpdateError as any)?.message || ''
        const code = (authUpdateError as any)?.code || ''
        let friendly = rawMsg
        if (/pwned|weak|leaked|known to be/i.test(rawMsg) || code === 'weak_password') {
          friendly = 'Mật khẩu quá yếu hoặc đã bị lộ trong các vụ rò rỉ dữ liệu. Vui lòng chọn mật khẩu mạnh hơn (kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt).'
        } else if (/email/i.test(rawMsg) && /invalid/i.test(rawMsg)) {
          friendly = 'Email không hợp lệ.'
        } else if (/already (registered|exists)|duplicate/i.test(rawMsg)) {
          friendly = 'Email này đã được sử dụng bởi tài khoản khác.'
        } else if (/password.*(short|length|at least)/i.test(rawMsg)) {
          friendly = 'Mật khẩu quá ngắn. Tối thiểu 6 ký tự.'
        }
        return new Response(JSON.stringify({ error: friendly, raw: rawMsg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Sync email to platform_users
      if (email) {
        const { data: existingPlatformUser } = await supabaseAdmin
          .from('platform_users')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()

        if (existingPlatformUser) {
          await supabaseAdmin.from('platform_users').update({ email }).eq('user_id', userId)
        }
      }
    }

    // Update profile (displayName/phone)
    const profileUpdates: { display_name?: string; phone?: string } = {}
    if (displayName) profileUpdates.display_name = displayName
    if (phone !== undefined) profileUpdates.phone = phone

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('user_id', userId)

      if (profileError) {
        console.error('Profile update error:', profileError)
        return new Response(JSON.stringify({ error: 'Không thể cập nhật thông tin người dùng' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Sync to platform_users
      const platformUserUpdates: Record<string, string> = {}
      if (displayName) platformUserUpdates.display_name = displayName
      if (phone !== undefined) platformUserUpdates.phone = phone

      if (Object.keys(platformUserUpdates).length > 0) {
        await supabaseAdmin.from('platform_users').update(platformUserUpdates).eq('user_id', userId)
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Cập nhật thành công' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Lỗi hệ thống' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
