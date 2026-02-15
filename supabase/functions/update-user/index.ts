import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const supabaseUrlRL = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKeyRL = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const rlClient = createClient(supabaseUrlRL, supabaseServiceKeyRL, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: allowed } = await rlClient.rpc('check_rate_limit', { _function_name: 'update-user', _ip_address: clientIP, _max_requests: 30, _window_minutes: 60 })
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get the authorization header to verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Không có quyền truy cập' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify the caller is a super_admin
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Không thể xác thực người dùng' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caller's tenant_id from platform_users
    const { data: callerPlatform } = await supabaseAdmin
      .from('platform_users')
      .select('tenant_id')
      .eq('user_id', caller.id)
      .maybeSingle()

    const callerTenantId = callerPlatform?.tenant_id

    // Check if caller is super_admin (filter by tenant to avoid .single() error on multi-tenant)
    let callerRoleQuery = supabaseAdmin
      .from('user_roles')
      .select('user_role')
      .eq('user_id', caller.id)

    if (callerTenantId) {
      callerRoleQuery = callerRoleQuery.eq('tenant_id', callerTenantId)
    }

    const { data: callerRole, error: roleError } = await callerRoleQuery.maybeSingle()

    if (roleError || callerRole?.user_role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Chỉ Admin Tổng mới có quyền chỉnh sửa tài khoản' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const { userId, email, password, displayName, phone } = body
    console.log('Update user request:', { userId, hasEmail: !!email, hasPassword: !!password, hasDisplayName: !!displayName, hasPhone: phone !== undefined })

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin người dùng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check target user's role (filter by same tenant)
    let targetRoleQuery = supabaseAdmin
      .from('user_roles')
      .select('user_role')
      .eq('user_id', userId)

    if (callerTenantId) {
      targetRoleQuery = targetRoleQuery.eq('tenant_id', callerTenantId)
    }

    const { data: targetRole, error: targetRoleError } = await targetRoleQuery.maybeSingle()

    if (targetRoleError || !targetRole) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy người dùng' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (targetRole.user_role === 'super_admin' && userId !== caller.id) {
      return new Response(
        JSON.stringify({ error: 'Không thể chỉnh sửa tài khoản Admin Tổng khác' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update auth user (email/password) if provided
    const authUpdates: { email?: string; password?: string } = {}
    if (email) authUpdates.email = email
    if (password) authUpdates.password = password

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        authUpdates
      )

      if (authUpdateError) {
        console.error('Auth update error:', authUpdateError)
        return new Response(
          JSON.stringify({ error: authUpdateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Also update/insert email in platform_users table for display purposes
      if (email) {
        // First check if platform_users record exists
        const { data: existingPlatformUser } = await supabaseAdmin
          .from('platform_users')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()

        if (existingPlatformUser) {
          // Update existing record
          const { error: platformUserError } = await supabaseAdmin
            .from('platform_users')
            .update({ email: email })
            .eq('user_id', userId)

          if (platformUserError) {
            console.error('Platform user email update error:', platformUserError)
          }
        } else {
          // Use already-fetched callerTenantId instead of re-querying
          const callerPlatformTenantId = callerTenantId

          // Fetch existing profile to satisfy NOT NULL display_name constraint on platform_users
          const { data: targetProfile } = await supabaseAdmin
            .from('profiles')
            .select('display_name, phone')
            .eq('user_id', userId)
            .maybeSingle()

          if (callerPlatformTenantId) {
            const resolvedDisplayName =
              (displayName?.trim() || '') ||
              (targetProfile?.display_name?.trim() || '') ||
              email

            // Create new platform_users record for this user (display_name is required)
            const { error: insertError } = await supabaseAdmin
              .from('platform_users')
              .insert({
                user_id: userId,
                email: email,
                tenant_id: callerPlatformTenantId,
                display_name: resolvedDisplayName,
                phone: phone !== undefined ? phone : (targetProfile?.phone ?? null),
                is_active: true,
              })

            if (insertError) {
              console.error('Platform user insert error:', insertError)
            }
          }
        }
      }
    }

    // Update profile (displayName/phone) if provided
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
        return new Response(
          JSON.stringify({ error: 'Không thể cập nhật thông tin người dùng' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Also sync displayName/phone to platform_users if record exists
      const platformUserUpdates: Record<string, string> = {}
      if (displayName) platformUserUpdates.display_name = displayName
      if (phone !== undefined) platformUserUpdates.phone = phone

      if (Object.keys(platformUserUpdates).length > 0) {
        const { error: platformSyncError } = await supabaseAdmin
          .from('platform_users')
          .update(platformUserUpdates)
          .eq('user_id', userId)

        if (platformSyncError) {
          console.error('Platform user sync error (non-fatal):', platformSyncError)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Cập nhật thành công'
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
