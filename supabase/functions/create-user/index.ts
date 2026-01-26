import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    // Check if caller is super_admin
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_role')
      .eq('user_id', caller.id)
      .single()

    if (roleError || callerRole?.user_role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Chỉ Admin Tổng mới có quyền tạo tài khoản' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, password, displayName, phone, role, branchId } = await req.json()

    if (!email || !password || !displayName) {
      return new Response(
        JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Không cho phép tạo super_admin - chỉ có duy nhất 1 tài khoản
    if (role === 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Không thể tạo thêm tài khoản Admin Tổng' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if email already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('List users error:', listError)
      return new Response(
        JSON.stringify({ error: 'Không thể kiểm tra email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailExists = existingUsers.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'Email này đã được sử dụng cho tài khoản khác' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the user using admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        display_name: displayName,
      },
    })

    if (createError) {
      console.error('Create user error:', createError)
      // Translate common error messages to Vietnamese
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

    // Update the profile with phone number if provided
    if (phone) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ phone })
        .eq('user_id', newUser.user.id)

      if (profileError) {
        console.error('Profile update error:', profileError)
      }
    }

    // Update the user_role with the specified role and branch
    const { error: roleUpdateError } = await supabaseAdmin
      .from('user_roles')
      .update({
        user_role: role,
        branch_id: role === 'super_admin' ? null : branchId,
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
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email 
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
