import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320
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

    // Verify caller is platform_admin
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Chưa đăng nhập' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: callerPlatform } = await supabaseAdmin
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (callerPlatform?.platform_role !== 'platform_admin') {
      return new Response(
        JSON.stringify({ error: 'Chỉ Super Admin mới có quyền quản lý Company Admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action } = body

    // === CREATE company admin ===
    if (action === 'create') {
      const { email, password, company_id, display_name } = body

      if (!email || !password || !company_id) {
        return new Response(
          JSON.stringify({ error: 'Thiếu thông tin: email, password, company_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!validateEmail(email)) {
        return new Response(
          JSON.stringify({ error: 'Email không hợp lệ' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check company exists
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('id, name')
        .eq('id', company_id)
        .single()

      if (!company) {
        return new Response(
          JSON.stringify({ error: 'Công ty không tồn tại' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if company already has an admin
      const { data: existingAdmin } = await supabaseAdmin
        .from('platform_users')
        .select('id, email')
        .eq('company_id', company_id)
        .eq('platform_role', 'company_admin')
        .maybeSingle()

      if (existingAdmin) {
        return new Response(
          JSON.stringify({ error: `Công ty này đã có admin: ${existingAdmin.email}` }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'company_admin', company_id },
      })

      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create platform_users record
      const { error: puError } = await supabaseAdmin
        .from('platform_users')
        .insert({
          user_id: newUser.user!.id,
          platform_role: 'company_admin',
          company_id,
          display_name: display_name || email.split('@')[0],
          email,
          is_active: true,
        })

      if (puError) {
        // Cleanup: delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(newUser.user!.id)
        return new Response(
          JSON.stringify({ error: puError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, user_id: newUser.user!.id, message: `Đã tạo admin cho ${company.name}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // === DELETE company admin ===
    if (action === 'delete') {
      const { user_id } = body

      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'Thiếu user_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify target is a company_admin
      const { data: targetPU } = await supabaseAdmin
        .from('platform_users')
        .select('platform_role')
        .eq('user_id', user_id)
        .maybeSingle()

      if (!targetPU || targetPU.platform_role !== 'company_admin') {
        return new Response(
          JSON.stringify({ error: 'User không phải Company Admin' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Delete platform_users record
      await supabaseAdmin.from('platform_users').delete().eq('user_id', user_id)

      // Delete auth user
      await supabaseAdmin.auth.admin.deleteUser(user_id)

      return new Response(
        JSON.stringify({ success: true, message: 'Đã xóa Company Admin' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // === UPDATE company admin password ===
    if (action === 'update_password') {
      const { user_id, new_password } = body

      if (!user_id || !new_password) {
        return new Response(
          JSON.stringify({ error: 'Thiếu user_id hoặc new_password' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: new_password,
      })

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Đã cập nhật mật khẩu' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // === LIST company admins ===
    if (action === 'list') {
      const { data: admins, error } = await supabaseAdmin
        .from('platform_users')
        .select('id, user_id, email, display_name, company_id, is_active, created_at')
        .eq('platform_role', 'company_admin')
        .order('created_at', { ascending: false })

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ admins: admins || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Action không hợp lệ. Hỗ trợ: create, delete, update_password, list' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Lỗi server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
