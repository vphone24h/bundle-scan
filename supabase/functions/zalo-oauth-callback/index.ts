import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Handle GET redirect from Zalo OAuth
  if (req.method === "GET") {
    const code = url.searchParams.get("code");
    const oaId = url.searchParams.get("oa_id");
    const state = url.searchParams.get("state"); // tenant_id

    // Return HTML that sends message to opener and closes
    const html = `<!DOCTYPE html>
<html><head><title>Zalo OAuth</title></head>
<body>
<p style="font-family:sans-serif;text-align:center;margin-top:40px;">Đang kết nối Zalo OA...</p>
<script>
  if (window.opener) {
    window.opener.postMessage({
      type: 'zalo-oauth-callback',
      code: ${JSON.stringify(code || "")},
      oa_id: ${JSON.stringify(oaId || "")},
      state: ${JSON.stringify(state || "")}
    }, '*');
    setTimeout(() => window.close(), 1500);
  } else {
    document.body.innerHTML = '<p style="font-family:sans-serif;text-align:center;margin-top:40px;">Kết nối thành công! Bạn có thể đóng tab này.</p>';
  }
</script>
</body></html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const { action, tenant_id, code, app_id, app_secret } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: get_oauth_url
    if (action === "get_oauth_url") {
      if (!app_id || !tenant_id) {
        return new Response(
          JSON.stringify({ error: "Missing app_id or tenant_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const redirectUri = `${supabaseUrl}/functions/v1/zalo-oauth-callback`;

      const oauthUrl =
        `https://oauth.zaloapp.com/v4/oa/permission` +
        `?app_id=${encodeURIComponent(app_id)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(tenant_id)}`;

      return new Response(
        JSON.stringify({ oauth_url: oauthUrl, redirect_uri: redirectUri }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: exchange_code
    if (action === "exchange_code") {
      if (!code || !tenant_id) {
        return new Response(
          JSON.stringify({ error: "Missing code or tenant_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let finalAppId = app_id;
      let finalAppSecret = app_secret;

      if (!finalAppId || !finalAppSecret) {
        const { data: settings } = await supabaseAdmin
          .from("tenant_landing_settings")
          .select("zalo_app_id, zalo_app_secret")
          .eq("tenant_id", tenant_id)
          .maybeSingle();

        finalAppId = finalAppId || settings?.zalo_app_id;
        finalAppSecret = finalAppSecret || settings?.zalo_app_secret;
      }

      if (!finalAppId || !finalAppSecret) {
        return new Response(
          JSON.stringify({ error: "Chưa cấu hình App ID hoặc Secret Key" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const redirectUri = `${supabaseUrl}/functions/v1/zalo-oauth-callback`;

      const tokenRes = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: finalAppSecret,
        },
        body: new URLSearchParams({
          code,
          app_id: finalAppId,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenRes.json();
      console.log("Zalo token response:", JSON.stringify(tokenData));

      if (tokenData.error) {
        return new Response(
          JSON.stringify({
            error: "Lỗi lấy token từ Zalo",
            details: tokenData.error_description || tokenData.error_name || tokenData.error,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "Không nhận được access_token từ Zalo" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const oaInfoRes = await fetch("https://openapi.zalo.me/v2.0/oa/getoa", {
        headers: { access_token: accessToken },
      });
      const oaInfo = await oaInfoRes.json();
      console.log("OA info:", JSON.stringify(oaInfo));

      const oaId = oaInfo.data?.oa_id || "";
      const oaName = oaInfo.data?.name || "";

      const { error: updateError } = await supabaseAdmin
        .from("tenant_landing_settings")
        .update({
          zalo_access_token: accessToken,
          zalo_refresh_token: refreshToken,
          zalo_oa_id: oaId ? String(oaId) : null,
          zalo_enabled: true,
          zalo_app_id: finalAppId,
          zalo_app_secret: finalAppSecret,
        })
        .eq("tenant_id", tenant_id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Lỗi lưu token", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          oa_id: oaId,
          oa_name: oaName,
          message: "Kết nối Zalo OA thành công!",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: refresh_token
    if (action === "refresh_token") {
      if (!tenant_id) {
        return new Response(
          JSON.stringify({ error: "Missing tenant_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: settings } = await supabaseAdmin
        .from("tenant_landing_settings")
        .select("zalo_app_id, zalo_app_secret, zalo_refresh_token")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (!settings?.zalo_refresh_token || !settings?.zalo_app_id || !settings?.zalo_app_secret) {
        return new Response(
          JSON.stringify({ error: "Thiếu thông tin để gia hạn token. Vui lòng kết nối lại." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const refreshRes = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: settings.zalo_app_secret,
        },
        body: new URLSearchParams({
          refresh_token: settings.zalo_refresh_token,
          app_id: settings.zalo_app_id,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshRes.json();
      console.log("Refresh token response:", JSON.stringify(refreshData));

      if (refreshData.error || !refreshData.access_token) {
        return new Response(
          JSON.stringify({
            error: "Gia hạn token thất bại. Vui lòng kết nối lại Zalo OA.",
            details: refreshData.error_description || refreshData.error,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseAdmin
        .from("tenant_landing_settings")
        .update({
          zalo_access_token: refreshData.access_token,
          zalo_refresh_token: refreshData.refresh_token || settings.zalo_refresh_token,
        })
        .eq("tenant_id", tenant_id);

      return new Response(
        JSON.stringify({ success: true, message: "Đã gia hạn token thành công" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: disconnect
    if (action === "disconnect") {
      await supabaseAdmin
        .from("tenant_landing_settings")
        .update({
          zalo_access_token: null,
          zalo_refresh_token: null,
          zalo_oa_id: null,
          zalo_enabled: false,
          zalo_app_id: null,
          zalo_app_secret: null,
        })
        .eq("tenant_id", tenant_id);

      return new Response(
        JSON.stringify({ success: true, message: "Đã ngắt kết nối Zalo OA" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Zalo OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
