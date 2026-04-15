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

  // GET request = Zalo webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("challenge");
    if (challenge) {
      console.log("Webhook verification challenge:", challenge);
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Zalo webhook event:", JSON.stringify(body));

    const { event_name, app_id, sender, recipient, message, timestamp, follower, oa_id } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find tenant by oa_id
    const oaId = oa_id || recipient?.id;
    if (!oaId) {
      console.log("No oa_id in webhook event, skipping");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenantSettings } = await supabaseAdmin
      .from("tenant_landing_settings")
      .select("tenant_id, zalo_access_token")
      .eq("zalo_oa_id", oaId)
      .maybeSingle();

    if (!tenantSettings) {
      console.log("No tenant found for OA ID:", oaId);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = tenantSettings.tenant_id;
    const accessToken = tenantSettings.zalo_access_token;

    // Handle follow event
    if (event_name === "follow" || event_name === "oa.follow") {
      const userId = follower?.id || sender?.id;
      if (!userId) {
        console.log("No user_id in follow event");
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to get user profile for display name and phone
      let displayName = "";
      let avatarUrl = "";
      let phone = "";

      if (accessToken) {
        try {
          const profileRes = await fetch(
            `https://openapi.zalo.me/v3.0/oa/user/detail?user_id=${userId}`,
            { headers: { access_token: accessToken } }
          );
          const profileData = await profileRes.json();
          console.log("User profile:", JSON.stringify(profileData));

          if (profileData.error === 0 && profileData.data) {
            displayName = profileData.data.display_name || profileData.data.name || "";
            avatarUrl = profileData.data.avatar || profileData.data.avatars?.["120"] || "";
            phone = profileData.data.shared_info?.phone || profileData.data.phone || "";
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
        }
      }

      // Normalize phone
      if (phone && phone.startsWith("84")) {
        phone = "0" + phone.substring(2);
      }

      // Upsert follower
      const { error: upsertError } = await supabaseAdmin
        .from("zalo_oa_followers")
        .upsert(
          {
            tenant_id: tenantId,
            zalo_user_id: userId,
            display_name: displayName || null,
            avatar_url: avatarUrl || null,
            phone: phone || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,zalo_user_id" }
        );

      if (upsertError) {
        console.error("Error upserting follower:", upsertError);
      } else {
        console.log(`Follower saved: ${userId} (${displayName}) for tenant ${tenantId}`);
      }
    }

    // Handle unfollow event
    if (event_name === "unfollow" || event_name === "oa.unfollow") {
      const userId = follower?.id || sender?.id;
      if (userId) {
        const { error: deleteError } = await supabaseAdmin
          .from("zalo_oa_followers")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("zalo_user_id", userId);

        if (deleteError) {
          console.error("Error deleting follower:", deleteError);
        } else {
          console.log(`Follower removed: ${userId} for tenant ${tenantId}`);
        }
      }
    }

    // Handle user_send_text — could be used for auto-reply or logging
    if (event_name === "user_send_text" || event_name === "oa.message.receive") {
      const userId = sender?.id;
      const text = message?.text;
      console.log(`Message from ${userId}: ${text}`);

      // Try to upsert sender as follower (they must be following to send messages)
      if (userId) {
        await supabaseAdmin
          .from("zalo_oa_followers")
          .upsert(
            {
              tenant_id: tenantId,
              zalo_user_id: userId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,zalo_user_id", ignoreDuplicates: true }
          );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Always return 200 to Zalo so they don't retry excessively
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
