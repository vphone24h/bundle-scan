import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Chưa đăng nhập' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Không xác thực được người dùng' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify platform_admin
    const { data: pu } = await supabaseAdmin
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (pu?.platform_role !== 'platform_admin') {
      return new Response(JSON.stringify({ error: 'Chỉ Platform Admin được phép cập nhật' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { smtp_user, smtp_password } = await req.json();
    const cleanUser = (smtp_user || '').toString().trim();
    const cleanPass = (smtp_password || '').toString().replace(/\s+/g, '');

    if (!cleanUser || !cleanPass) {
      return new Response(JSON.stringify({ error: 'Vui lòng nhập đầy đủ Email và App Password' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanUser)) {
      return new Response(JSON.stringify({ error: 'Email không hợp lệ' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (cleanPass.length !== 16) {
      return new Response(JSON.stringify({ error: 'App Password phải đủ 16 ký tự (bỏ dấu cách)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save to global_smtp_config table (single row id=1)
    const { error: upErr } = await supabaseAdmin
      .from('global_smtp_config')
      .upsert({
        id: 1,
        smtp_user: cleanUser,
        smtp_password: cleanPass,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('update-global-smtp error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Lỗi không xác định' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
