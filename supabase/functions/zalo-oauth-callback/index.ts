import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Resolve Zalo App credentials: tenant_landing_settings → payment_config (company) → payment_config (platform)
async function resolveZaloAppCredentials(
  supabaseAdmin: any,
  tenantId: string,
  providedAppId?: string,
  providedAppSecret?: string
): Promise<{ app_id: string; app_secret: string } | null> {
  if (providedAppId && providedAppSecret) {
    return { app_id: providedAppId, app_secret: providedAppSecret };
  }

  // 1. Check tenant_landing_settings
  const { data: tenantSettings } = await supabaseAdmin
    .from("tenant_landing_settings")
    .select("zalo_app_id, zalo_app_secret")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let appId = providedAppId || tenantSettings?.zalo_app_id;
  let appSecret = providedAppSecret || tenantSettings?.zalo_app_secret;

  if (appId && appSecret) return { app_id: appId, app_secret: appSecret };

  // 2. Get tenant's company_id
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_id")
    .eq("id", tenantId)
    .maybeSingle();

  // 3. Check payment_config for company
  if (tenant?.company_id) {
    const { data: companyConfig } = await supabaseAdmin
      .from("payment_config")
      .select("config_key, config_value")
      .eq("company_id", tenant.company_id)
      .in("config_key", ["zalo_app_id", "zalo_app_secret"]);

    if (companyConfig?.length) {
      for (const c of companyConfig) {
        if (c.config_key === "zalo_app_id" && !appId) appId = c.config_value;
        if (c.config_key === "zalo_app_secret" && !appSecret) appSecret = c.config_value;
      }
    }
  }

  if (appId && appSecret) return { app_id: appId, app_secret: appSecret };

  // 4. Fallback: platform-level (company_id IS NULL)
  const { data: platformConfig } = await supabaseAdmin
    .from("payment_config")
    .select("config_key, config_value")
    .is("company_id", null)
    .in("config_key", ["zalo_app_id", "zalo_app_secret"]);

  if (platformConfig?.length) {
    for (const c of platformConfig) {
      if (c.config_key === "zalo_app_id" && !appId) appId = c.config_value;
      if (c.config_key === "zalo_app_secret" && !appSecret) appSecret = c.config_value;
    }
  }

  if (appId && appSecret) return { app_id: appId, app_secret: appSecret };

  // 5. Fallback: environment variables (secrets)
  const envAppId = Deno.env.get("ZALO_APP_ID");
  const envAppSecret = Deno.env.get("ZALO_APP_SECRET");
  if (envAppId && envAppSecret) {
    return { app_id: appId || envAppId, app_secret: appSecret || envAppSecret };
  }

  return null;
}

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

    // Action: get_oauth_url — auto-resolve app_id if not provided
    if (action === "get_oauth_url") {
      if (!tenant_id) {
        return new Response(
          JSON.stringify({ error: "Missing tenant_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const creds = await resolveZaloAppCredentials(supabaseAdmin, tenant_id, app_id, app_secret);
      if (!creds) {
        return new Response(
          JSON.stringify({ error: "Chưa cấu hình Zalo App ID. Vui lòng liên hệ quản trị viên." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use custom domain for redirect URI (must match Zalo App's verified domain)
      const redirectUri = "https://vkho.vn/zalo-callback";

      const oauthUrl =
        `https://oauth.zaloapp.com/v4/oa/permission` +
        `?app_id=${encodeURIComponent(creds.app_id)}` +
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

      const creds = await resolveZaloAppCredentials(supabaseAdmin, tenant_id, app_id, app_secret);
      if (!creds) {
        return new Response(
          JSON.stringify({ error: "Chưa cấu hình App ID hoặc Secret Key" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const redirectUri = "https://vkho.vn/zalo-callback";

      const tokenRes = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: creds.app_secret,
        },
        body: new URLSearchParams({
          code,
          app_id: creds.app_id,
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
      const oaAvatar = oaInfo.data?.avatar || oaInfo.data?.cover || "";

      const { error: updateError } = await supabaseAdmin
        .from("tenant_landing_settings")
        .update({
          zalo_access_token: accessToken,
          zalo_refresh_token: refreshToken,
          zalo_oa_id: oaId ? String(oaId) : null,
          zalo_oa_name: oaName || null,
          zalo_oa_avatar: oaAvatar || null,
          zalo_enabled: true,
          zalo_app_id: creds.app_id,
          zalo_app_secret: creds.app_secret,
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
          oa_avatar: oaAvatar,
          message: `Kết nối Zalo OA "${oaName || oaId}" thành công!`,
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

      const creds = await resolveZaloAppCredentials(supabaseAdmin, tenant_id);
      const { data: settings } = await supabaseAdmin
        .from("tenant_landing_settings")
        .select("zalo_refresh_token")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (!settings?.zalo_refresh_token || !creds) {
        return new Response(
          JSON.stringify({ error: "Thiếu thông tin để gia hạn token. Vui lòng kết nối lại." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const refreshRes = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: creds.app_secret,
        },
        body: new URLSearchParams({
          refresh_token: settings.zalo_refresh_token,
          app_id: creds.app_id,
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
          zalo_oa_name: null,
          zalo_oa_avatar: null,
          zalo_enabled: false,
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
