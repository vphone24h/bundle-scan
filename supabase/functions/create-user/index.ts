import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function fail(error: string, errorCode: string, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ ok: false, success: false, error, errorCode, ...extra }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('cf-connecting-ip') 
    || req.headers.get('x-real-ip') 
    || '0.0.0.0'
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320
}

function sanitizeString(str: string, maxLength: number): string {
  return String(str).trim().slice(0, maxLength)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return fail('Không có quyền truy cập. Vui lòng đăng nhập lại.', 'UNAUTHORIZED')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Rate limiting: 20 user creations per IP per 60 minutes
    const clientIP = getClientIP(req)
    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', {
      _function_name: 'create-user',
      _ip_address: clientIP,
      _max_requests: 20,
      _window_minutes: 60,
    })

    if (!allowed) {
      return fail('Quá nhiều yêu cầu tạo nhân viên. Vui lòng thử lại sau 1 giờ.', 'RATE_LIMIT')
    }

    // Verify the caller is a super_admin
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !caller) {
      return fail('Không thể xác thực người dùng. Vui lòng đăng nhập lại.', 'AUTH_FAILED')
    }

    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_role, tenant_id')
      .eq('user_id', caller.id)
      .single()

    if (roleError || callerRole?.user_role !== 'super_admin') {
      return fail('Chỉ Admin Tổng mới có quyền tạo tài khoản nhân viên.', 'FORBIDDEN')
    }

    const callerTenantId = callerRole.tenant_id

    const body = await req.json()
    const email = sanitizeString(body.email || '', 320).toLowerCase()
    const password = body.password || ''
    const displayName = sanitizeString(body.displayName || '', 200)
    const phone = body.phone ? sanitizeString(body.phone, 20) : null
    const role = sanitizeString(body.role || '', 50)
    const branchId = body.branchId || null

    if (!email || !password || !displayName) {
      return fail('Thiếu thông tin bắt buộc (email, mật khẩu hoặc tên hiển thị).', 'MISSING_FIELDS')
    }

    if (!validateEmail(email)) {
      return fail('Định dạng email không hợp lệ.', 'INVALID_EMAIL')
    }

    if (password.length < 6 || password.length > 128) {
      return fail('Mật khẩu phải từ 6 đến 128 ký tự.', 'INVALID_PASSWORD')
    }

    // Check member limit for tenant
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('max_users')
      .eq('id', callerTenantId)
      .single()

    if (tenantError) {
      console.error('Tenant fetch error:', tenantError)
      return fail('Không thể kiểm tra thông tin cửa hàng: ' + tenantError.message, 'TENANT_FETCH_FAILED')
    }

    const maxUsers = tenantData?.max_users || 5

    // Count existing users in this tenant (excluding super_admin)
    const { count: currentUserCount, error: countError } = await supabaseAdmin
      .from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', callerTenantId)

    if (countError) {
      console.error('User count error:', countError)
      return fail('Không thể kiểm tra số lượng thành viên: ' + countError.message, 'USER_COUNT_FAILED')
    }

    if ((currentUserCount || 0) >= maxUsers) {
      return new Response(
        JSON.stringify({ 
          ok: false,
          error: `Đã đạt giới hạn ${maxUsers} thành viên, vui lòng nâng cấp gói để được nhiều nhân viên hơn`,
          errorCode: 'MEMBER_LIMIT_REACHED',
          currentCount: currentUserCount,
          maxUsers: maxUsers,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Không cho phép tạo super_admin
    if (role === 'super_admin') {
      return fail('Không thể tạo thêm tài khoản Admin Tổng.', 'CANNOT_CREATE_SUPER_ADMIN')
    }

    // Validate role is an allowed value
    const allowedRoles = ['branch_admin', 'cashier', 'staff']
    if (!allowedRoles.includes(role)) {
      return fail(`Vai trò không hợp lệ: "${role}". Phải là một trong: ${allowedRoles.join(', ')}.`, 'INVALID_ROLE')
    }

    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('List users error:', listError)
      return fail('Không thể kiểm tra email: ' + listError.message, 'LIST_USERS_FAILED')
    }

    const existingUser = existingUsers.users.find(u => u.email?.toLowerCase() === email)

    if (existingUser) {
      const { data: existingRoleInTenant } = await supabaseAdmin
        .from('user_roles')
        .select('id, user_role')
        .eq('user_id', existingUser.id)
        .eq('tenant_id', callerTenantId)
        .maybeSingle()

      if (existingRoleInTenant) {
        return fail(
          `Email "${email}" đã tồn tại trong cửa hàng với vai trò: ${existingRoleInTenant.user_role}.`,
          'EMAIL_EXISTS_IN_TENANT'
        )
      }

      const { error: insertRoleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: existingUser.id,
          user_role: role,
          branch_id: role === 'super_admin' ? null : branchId,
          tenant_id: callerTenantId,
        })

      if (insertRoleError) {
        console.error('Insert role error:', insertRoleError)
        return fail('Không thể thêm vai trò cho người dùng: ' + insertRoleError.message, 'INSERT_ROLE_FAILED')
      }

      if (phone) {
        await supabaseAdmin
          .from('profiles')
          .update({ phone })
          .eq('user_id', existingUser.id)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Đã thêm vai trò mới cho tài khoản hiện có',
          user: { id: existingUser.id, email: existingUser.email } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    })

    if (createError) {
      console.error('Create user error:', createError)
      let errorMessage = createError.message
      let errorCode = 'CREATE_USER_FAILED'
      if (createError.message.includes('already been registered')) {
        errorMessage = `Email "${email}" đã được đăng ký ở một tài khoản khác trong hệ thống. Vui lòng dùng email khác.`
        errorCode = 'EMAIL_ALREADY_REGISTERED'
      } else if (createError.message.includes('password')) {
        errorMessage = 'Mật khẩu không hợp lệ: ' + createError.message
        errorCode = 'INVALID_PASSWORD'
      }
      return fail(errorMessage, errorCode)
    }

    const profileUpdateData: Record<string, any> = { tenant_id: callerTenantId }
    if (phone) profileUpdateData.phone = phone
    
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdateData)
      .eq('user_id', newUser.user.id)

    if (profileError) console.error('Profile update error:', profileError)

    const { error: platformUserError } = await supabaseAdmin
      .from('platform_users')
      .insert({
        user_id: newUser.user.id,
        email,
        display_name: displayName,
        tenant_id: callerTenantId,
        is_active: true,
      })

    if (platformUserError) console.error('Platform user insert error:', platformUserError)

    const { error: roleUpdateError } = await supabaseAdmin
      .from('user_roles')
      .update({
        user_role: role,
        branch_id: role === 'super_admin' ? null : branchId,
        tenant_id: callerTenantId,
      })
      .eq('user_id', newUser.user.id)

    if (roleUpdateError) {
      console.error('Role update error:', roleUpdateError)
      return fail('Không thể cập nhật quyền người dùng: ' + roleUpdateError.message, 'ROLE_UPDATE_FAILED')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: newUser.user.id, email: newUser.user.email } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return fail('Lỗi hệ thống: ' + ((error as Error)?.message || String(error)), 'UNEXPECTED_ERROR')
  }
})
