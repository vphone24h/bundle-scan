import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
      return new Response(
        JSON.stringify({ error: 'Không có quyền truy cập' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_role, tenant_id')
      .eq('user_id', caller.id)
      .single()

    if (roleError || callerRole?.user_role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Chỉ Admin Tổng mới có quyền tạo tài khoản' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Định dạng email không hợp lệ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (password.length < 6 || password.length > 128) {
      return new Response(
        JSON.stringify({ error: 'Mật khẩu phải từ 6-128 ký tự' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Không cho phép tạo super_admin
    if (role === 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Không thể tạo thêm tài khoản Admin Tổng' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role is an allowed value
    const allowedRoles = ['branch_admin', 'cashier', 'staff']
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Vai trò không hợp lệ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('List users error:', listError)
      return new Response(
        JSON.stringify({ error: 'Không thể kiểm tra email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
        return new Response(
          JSON.stringify({ 
            error: `Email này đã được sử dụng trong cửa hàng của bạn (vai trò: ${existingRoleInTenant.user_role})` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        return new Response(
          JSON.stringify({ error: 'Không thể thêm vai trò cho người dùng' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
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
      if (createError.message.includes('already been registered')) {
        errorMessage = 'Email này đã được sử dụng cho tài khoản khác'
      } else if (createError.message.includes('password')) {
        errorMessage = 'Mật khẩu không hợp lệ'
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify({ error: 'Không thể cập nhật quyền người dùng' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
    return new Response(
      JSON.stringify({ error: 'Lỗi hệ thống' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
