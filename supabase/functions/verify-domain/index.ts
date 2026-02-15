import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rlClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: allowed } = await rlClient.rpc('check_rate_limit', { _function_name: 'verify-domain', _ip_address: clientIP, _max_requests: 10, _window_minutes: 60 });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { domainId } = await req.json();
    
    if (!domainId) {
      throw new Error('domainId is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Lấy thông tin domain
    const { data: domain, error } = await supabase
      .from('custom_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (error || !domain) {
      throw new Error('Domain không tồn tại');
    }

    // Check TXT record
    let txtRecords: string[][] = [];
    try {
      txtRecords = await Deno.resolveDns(
        `_lovable.${domain.domain}`,
        'TXT'
      );
    } catch (dnsError) {
      console.log('DNS lookup failed:', dnsError);
      // DNS lookup failed - domain chưa được cấu hình
    }

    const isVerified = txtRecords.some(
      (records) => records.some(
        (record) => record === domain.verification_token
      )
    );

    if (isVerified) {
      await supabase
        .from('custom_domains')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          ssl_status: 'pending', // Will be updated when SSL is provisioned
        })
        .eq('id', domainId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Domain đã được xác thực thành công!' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Không tìm thấy TXT record. Vui lòng kiểm tra cấu hình DNS và đợi 5-10 phút để DNS cập nhật.',
        expected_record: {
          type: 'TXT',
          name: `_lovable.${domain.domain}`,
          value: domain.verification_token,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Verify domain error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
