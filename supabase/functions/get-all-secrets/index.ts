import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: ue } = await userClient.auth.getUser()
    if (ue || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceRole)
    const { data: pu } = await admin
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (pu?.platform_role !== 'platform_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: platform_admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const env = Deno.env.toObject()
    const result = {
      _metadata: {
        exported_at: new Date().toISOString(),
        exported_by: user.email,
        total_keys: Object.keys(env).length,
        note: 'All Deno.env runtime secrets visible to edge functions. Includes SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, JWT_SECRET if exposed.',
      },
      env_secrets: env,
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="all_env_secrets_${new Date().toISOString().slice(0,10)}.json"`,
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})