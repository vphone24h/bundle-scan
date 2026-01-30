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

    // Check if caller is super_admin and get their tenant_id
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_role, tenant_id')
      .eq('user_id', caller.id)
      .single()

    if (roleError || callerRole?.user_role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Chỉ Admin Tổng mới có quyền xóa tài khoản' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerTenantId = callerRole.tenant_id

    // Parse request body
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Thiếu userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return new Response(
        JSON.stringify({ error: 'Không thể xóa tài khoản của chính mình' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if target user is a super_admin (cannot delete super_admin)
    const { data: targetRole } = await supabaseAdmin
      .from('user_roles')
      .select('user_role, tenant_id')
      .eq('user_id', userId)
      .eq('tenant_id', callerTenantId)
      .single()

    if (targetRole?.user_role === 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Không thể xóa tài khoản Admin Tổng' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete user_roles for this tenant
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('tenant_id', callerTenantId)

    if (deleteRoleError) {
      console.error('Delete role error:', deleteRoleError)
    }

    // Delete platform_users for this tenant
    const { error: deletePlatformUserError } = await supabaseAdmin
      .from('platform_users')
      .delete()
      .eq('user_id', userId)
      .eq('tenant_id', callerTenantId)

    if (deletePlatformUserError) {
      console.error('Delete platform_user error:', deletePlatformUserError)
    }

    // Check if user has roles in other tenants
    const { data: otherRoles } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    // If no other roles exist, delete the user completely from auth and profiles
    if (!otherRoles || otherRoles.length === 0) {
      // Delete profile
      const { error: deleteProfileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', userId)

      if (deleteProfileError) {
        console.error('Delete profile error:', deleteProfileError)
      }

      // Delete from auth.users
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (deleteAuthError) {
        console.error('Delete auth user error:', deleteAuthError)
        return new Response(
          JSON.stringify({ error: 'Không thể xóa tài khoản: ' + deleteAuthError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: otherRoles && otherRoles.length > 0 
          ? 'Đã xóa người dùng khỏi cửa hàng này (tài khoản vẫn tồn tại ở cửa hàng khác)'
          : 'Đã xóa người dùng hoàn toàn'
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
