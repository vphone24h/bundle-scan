import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildMessageText(params: {
  message_type: string;
  customer_name?: string;
  product_name?: string;
  product_price?: number;
  order_code?: string;
  total_amount?: number;
  items?: any[];
  receipt_code?: string;
  storeName: string;
  hotline: string;
}): string {
  const { message_type, customer_name, product_name, product_price, order_code, total_amount, items, receipt_code, storeName, hotline } = params;

  if (message_type === "test") {
    return `Xin chào! Đây là tin nhắn test từ ${storeName}. Cấu hình Zalo OA đã hoạt động thành công! ✅`;
  }

  if (message_type === "order_confirmation") {
    const priceFormatted = product_price ? new Intl.NumberFormat("vi-VN").format(product_price) + "đ" : "";
    return (
      `Xin chào ${customer_name || "bạn"},\n\n` +
      `Cảm ơn bạn đã đặt hàng tại ${storeName}.\n\n` +
      `Đơn hàng của bạn đã được ghi nhận:\n` +
      `📦 Sản phẩm: ${product_name || ""}\n` +
      `🔢 Mã đơn hàng: ${order_code || ""}\n` +
      (priceFormatted ? `💰 Giá: ${priceFormatted}\n` : "") +
      `\nCửa hàng sẽ liên hệ với bạn sớm nhất.` +
      (hotline ? `\n📞 Hotline: ${hotline}` : "")
    );
  }

  if (message_type === "export_confirmation") {
    const totalFormatted = total_amount ? new Intl.NumberFormat("vi-VN").format(total_amount) + "đ" : "";
    let itemsText = "";
    if (items && items.length > 0) {
      itemsText = items
        .map((item: any, i: number) =>
          `${i + 1}. ${item.product_name}${item.imei ? ` (IMEI: ${item.imei})` : ""}${item.warranty ? ` - BH: ${item.warranty}` : ""}`
        )
        .join("\n");
    }
    return (
      `Xin chào ${customer_name || "bạn"},\n\n` +
      `Cảm ơn bạn đã mua hàng tại ${storeName}! 🎉\n\n` +
      `Chi tiết đơn hàng${receipt_code ? ` ${receipt_code}` : ""}:\n` +
      (itemsText ? `${itemsText}\n` : "") +
      (totalFormatted ? `\n💰 Tổng tiền: ${totalFormatted}\n` : "") +
      `\nChúc bạn sử dụng sản phẩm vui vẻ!` +
      (hotline ? `\n📞 Hotline hỗ trợ: ${hotline}` : "")
    );
  }

  return "";
}

// Normalize phone to 84xxx format for ZNS
function normalizePhoneTo84(phone: string): string {
  let p = (phone || "").replace(/\s/g, "").replace(/[^0-9]/g, "");
  if (p.startsWith("0")) {
    p = "84" + p.substring(1);
  }
  return p;
}

// Normalize phone to 0xxx format for follower lookup
function normalizePhoneTo0(phone: string): string {
  let p = (phone || "").replace(/\s/g, "").replace(/[^0-9]/g, "");
  if (p.startsWith("84")) {
    p = "0" + p.substring(2);
  }
  return p;
}

// Validate phone format
function isValidPhone(phone: string): boolean {
  const p = normalizePhoneTo84(phone);
  return /^84\d{9}$/.test(p);
}

// Map message_type to event_type for template lookup
function getEventType(message_type: string): string {
  const map: Record<string, string> = {
    order_confirmation: "ORDER_CREATED",
    export_confirmation: "EXPORT_CREATED",
    order_shipped: "ORDER_SHIPPED",
    order_completed: "ORDER_COMPLETED",
    warranty_reminder: "WARRANTY_REMINDER",
  };
  return map[message_type] || "ORDER_CREATED";
}

// Safe extraction of user_id from raw JSON text to avoid JS number precision loss
function extractUserIdFromRaw(rawText: string): string | null {
  // Match "user_id":"1234567890123456789" or "user_id":1234567890123456789
  const match = rawText.match(/"user_id"\s*:\s*(?:"(\d+)"|(\d+))/);
  return match?.[1] ?? match?.[2] ?? null;
}

async function resolveZaloAppCredentials(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<{ app_id: string; app_secret: string } | null> {
  const { data: tenantSettings } = await supabaseAdmin
    .from("tenant_landing_settings")
    .select("zalo_app_id, zalo_app_secret")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let appId = tenantSettings?.zalo_app_id || null;
  let appSecret = tenantSettings?.zalo_app_secret || null;
  if (appId && appSecret) return { app_id: appId, app_secret: appSecret };

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenant?.company_id) {
    const { data: companyConfig } = await supabaseAdmin
      .from("payment_config")
      .select("config_key, config_value")
      .eq("company_id", tenant.company_id)
      .in("config_key", ["zalo_app_id", "zalo_app_secret"]);

    for (const item of companyConfig || []) {
      if (item.config_key === "zalo_app_id" && !appId) appId = item.config_value;
      if (item.config_key === "zalo_app_secret" && !appSecret) appSecret = item.config_value;
    }
  }

  if (appId && appSecret) return { app_id: appId, app_secret: appSecret };

  const { data: platformConfig } = await supabaseAdmin
    .from("payment_config")
    .select("config_key, config_value")
    .is("company_id", null)
    .in("config_key", ["zalo_app_id", "zalo_app_secret"]);

  for (const item of platformConfig || []) {
    if (item.config_key === "zalo_app_id" && !appId) appId = item.config_value;
    if (item.config_key === "zalo_app_secret" && !appSecret) appSecret = item.config_value;
  }

  if (appId && appSecret) return { app_id: appId, app_secret: appSecret };

  const envAppId = Deno.env.get("ZALO_APP_ID");
  const envAppSecret = Deno.env.get("ZALO_APP_SECRET");
  if (envAppId && envAppSecret) {
    return { app_id: appId || envAppId, app_secret: appSecret || envAppSecret };
  }

  return null;
}

// Get the first follower from OA's follower list (for test mode)
async function getFollowerByPhone(accessToken: string, phone: string): Promise<{ userId: string | null; error?: string }> {
  // Phone lookup not supported by Zalo API
  return { userId: null };
}

// Try sending CS to multiple followers until one succeeds (for test mode)
async function trySendCSToRecentFollowers(
  accessToken: string,
  messageText: string,
  maxTry: number = 10,
): Promise<{ userId: string | null; result: any }> {
  try {
    const res = await fetch("https://openapi.zalo.me/v3.0/oa/user/getlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: accessToken },
      body: JSON.stringify({ offset: 0, count: Math.min(maxTry, 50) }),
    });
    const rawText = await res.text();
    let data: any;
    try { data = JSON.parse(rawText); } catch { data = {}; }
    if (data.error && data.error !== 0) {
      return { userId: null, result: data };
    }
    const users = data.data?.users || [];
    if (users.length === 0) return { userId: null, result: { error: "no_followers" } };

    // Extract all user_ids safely from raw text
    const userIdMatches = [...rawText.matchAll(/"user_id"\s*:\s*"(\d+)"/g)];
    const userIds = userIdMatches.map(m => m[1]);
    console.log(`Testing CS to ${userIds.length} followers...`);

    for (const uid of userIds) {
      const csRes = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: accessToken },
        body: JSON.stringify({
          recipient: { user_id: uid },
          message: { text: messageText },
        }),
      });
      const csResult = await csRes.json();
      if (!csResult.error || csResult.error === 0) {
        console.log("CS success to follower:", uid);
        return { userId: uid, result: csResult };
      }
      console.log(`CS failed for ${uid}: ${csResult.message}`);
    }
    return { userId: null, result: { error: -230, message: "Không có follower nào tương tác OA trong 7 ngày gần đây" } };
  } catch (e) {
    return { userId: null, result: { error: -1, message: (e as Error).message } };
  }
}

async function getFirstFollower(accessToken: string): Promise<{ userId: string | null; error?: string }> {
  try {
    // v3.0 API requires POST with JSON body
    const res = await fetch("https://openapi.zalo.me/v3.0/oa/user/getlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: accessToken,
      },
      body: JSON.stringify({ offset: 0, count: 1 }),
    });
    const rawText = await res.text();
    console.log("Follower list v3.0 raw:", rawText);

    let data: any;
    try { data = JSON.parse(rawText); } catch { data = {}; }

    if (data.error === -124 || data.error === -216) {
      return { userId: null, error: "Access Token hết hạn. Vui lòng nhấn 'Gia hạn token'." };
    }

    if (data.error && data.error !== 0) {
      return { userId: null, error: `Zalo API lỗi: ${data.message || data.error}` };
    }

    // Extract user_id safely from raw text
    const userId = extractUserIdFromRaw(rawText);
    if (userId) {
      console.log("Found follower (safe extraction):", userId);
      return { userId };
    }

    // No followers
    const total = data.data?.total ?? 0;
    if (total === 0) {
      return { userId: null, error: "OA chưa có ai theo dõi. Hãy dùng Zalo quét QR hoặc tìm OA và nhấn 'Quan tâm'." };
    }

    return { userId: null, error: "Không thể đọc user_id từ danh sách follower." };
  } catch (e) {
    console.error("Error getting followers:", e);
    return { userId: null, error: `Lỗi kết nối Zalo API: ${(e as Error).message}` };
  }
}

async function getLatestStoredFollower(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("zalo_oa_followers")
      .select("zalo_user_id, phone, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error getting stored follower:", error);
      return null;
    }

    if (data?.zalo_user_id) {
      console.log("Using stored follower for test:", JSON.stringify(data));
      return data.zalo_user_id;
    }

    return null;
  } catch (e) {
    console.error("Error reading stored follower:", e);
    return null;
  }
}

// Send ZNS message with retry
async function sendZNSWithRetry(
  accessToken: string,
  phone: string,
  templateId: string,
  templateData: Record<string, string>,
  maxRetries = 3
): Promise<{ result: any; attempts: number }> {
  const phone84 = normalizePhoneTo84(phone);
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`ZNS attempt ${attempt}/${maxRetries} to ${phone84}, template: ${templateId}`);
      const res = await fetch("https://business.openapi.zalo.me/message/template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: accessToken,
        },
        body: JSON.stringify({
          phone: phone84,
          template_id: templateId,
          template_data: templateData,
        }),
      });

      const data = await res.json();
      console.log(`ZNS attempt ${attempt} response:`, JSON.stringify(data));

      // Success or non-retryable error
      if (!data.error || data.error === 0) {
        return { result: data, attempts: attempt };
      }

      // Token expired — not retryable
      if (data.error === -124 || data.error === -216) {
        return { result: data, attempts: attempt };
      }

      lastError = data;
    } catch (err) {
      console.error(`ZNS attempt ${attempt} error:`, err);
      lastError = { error: -1, message: (err as Error).message };
    }

    // Delay before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  return { result: lastError, attempts: maxRetries };
}

// Send CS message by phone number (requires "Gửi tin qua số điện thoại" permission)
async function sendCSByPhone(
  oaId: string,
  accessToken: string,
  appSecret: string,
  phone: string,
  messageText: string,
  templateId?: string | null,
): Promise<{ success: boolean; result: any }> {
  const phone0 = normalizePhoneTo0(phone);
  try {
    if (!templateId) {
      return {
        success: false,
        result: {
          error: "missing_template",
          message: "Chưa cấu hình template Zalo cho gửi theo số điện thoại.",
        },
      };
    }

    const templateData = JSON.stringify({ content: messageText });
    const timestamp = Date.now();
    const mac = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${oaId}${templateData}${timestamp}${appSecret}`),
    ).then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));

    console.log("Sending CS by phone to:", phone0, "with template:", templateId);
    const body = new URLSearchParams({
      oaid: oaId,
      timestamp: String(timestamp),
      mac,
      data: JSON.stringify({
        phone: phone0,
        templateid: String(templateId),
        templatedata: { content: messageText },
      }),
    });

    const res = await fetch("https://openapi.zaloapp.com/oa/v1/sendmessage/phone/cs", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        access_token: accessToken,
      },
      body,
    });
    const raw = await res.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { data = { error: -1, message: raw }; }
    console.log("CS by phone result:", JSON.stringify(data));
    return { success: !data.error || data.error === 0, result: data };
  } catch (err) {
    console.error("CS by phone error:", err);
    return { success: false, result: { error: -1, message: (err as Error).message } };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      tenant_id,
      customer_name,
      customer_phone,
      message_type,
      order_code,
      product_name,
      product_price,
      total_amount,
      items,
      receipt_code,
      branch_id,
      zalo_user_id,
      custom_message,
    } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get tenant landing settings for Zalo config
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("tenant_landing_settings")
      .select("zalo_oa_id, zalo_access_token, zalo_enabled, store_name, store_phone, zalo_zns_template_id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Tenant settings not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.zalo_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: "Zalo disabled, skipped" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.zalo_oa_id || !settings.zalo_access_token) {
      return new Response(
        JSON.stringify({ error: "Zalo OA not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone number
    if (customer_phone && !isValidPhone(customer_phone) && message_type !== "test") {
      console.log("Invalid phone format:", customer_phone);
      return new Response(
        JSON.stringify({ success: true, message: "Invalid phone format, skipped" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get branch hotline
    let hotline = settings.store_phone || "";
    if (branch_id) {
      const { data: branch } = await supabaseAdmin
        .from("branches")
        .select("phone")
        .eq("id", branch_id)
        .maybeSingle();
      if (branch?.phone) hotline = branch.phone;
    }

    const storeName = settings.store_name || "Cửa hàng";
    const zaloAppCreds = await resolveZaloAppCredentials(supabaseAdmin, tenant_id);

    // Look up ZNS template from zalo_zns_templates table
    const eventType = getEventType(message_type);
    const { data: znsTemplate } = await supabaseAdmin
      .from("zalo_zns_templates")
      .select("template_id, template_name")
      .eq("tenant_id", tenant_id)
      .eq("event_type", eventType)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // Fallback to legacy single template_id
    const znsTemplateId = znsTemplate?.template_id || settings.zalo_zns_template_id;

    // Build message content (for CS messages)
    const messageText = custom_message || buildMessageText({
      message_type,
      customer_name,
      product_name,
      product_price,
      order_code,
      total_amount,
      items,
      receipt_code,
      storeName,
      hotline,
    });

    if (!messageText) {
      return new Response(
        JSON.stringify({ error: "Invalid message_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine recipient Zalo user_id for CS message
    let recipientUserId = zalo_user_id || null;

    if (message_type === "test") {
      // For test: try to find follower by phone first via DB, then Zalo API, then get any follower
      if (!recipientUserId && customer_phone) {
        const normalizedPhone = normalizePhoneTo0(customer_phone);
        const { data: follower } = await supabaseAdmin
          .from("zalo_oa_followers")
          .select("zalo_user_id")
          .eq("tenant_id", tenant_id)
          .eq("phone", normalizedPhone)
          .maybeSingle();
        if (follower?.zalo_user_id) {
          recipientUserId = follower.zalo_user_id;
        }
      }
      // Try Zalo API to find follower by phone number
      if (!recipientUserId && customer_phone) {
        const phoneResult = await getFollowerByPhone(settings.zalo_access_token, customer_phone);
        if (phoneResult.userId) {
          recipientUserId = phoneResult.userId;
          console.log("Test: found follower by phone via Zalo API:", recipientUserId);
        } else if (phoneResult.error) {
          return new Response(
            JSON.stringify({ error: phoneResult.error }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      // If no specific follower found, try sending to recent followers until one works
      if (!recipientUserId) {
        // Will be handled after logId is created — set flag
        console.log("Test: no specific follower found, will try multiple followers after log creation");
      }
    } else {
      // Find user by phone in zalo_followers table
      if (!recipientUserId && customer_phone) {
        const normalizedPhone = normalizePhoneTo0(customer_phone);
        const { data: follower } = await supabaseAdmin
          .from("zalo_oa_followers")
          .select("zalo_user_id")
          .eq("tenant_id", tenant_id)
          .eq("phone", normalizedPhone)
          .maybeSingle();
        if (follower?.zalo_user_id) {
          recipientUserId = follower.zalo_user_id;
        }
      }
    }

    // Build ZNS template data
    const znsTemplateData = {
      customer_name: customer_name || "Quý khách",
      order_code: order_code || receipt_code || "",
      store_name: storeName,
      hotline: hotline,
      amount: total_amount ? new Intl.NumberFormat("vi-VN").format(total_amount) + "đ" : "",
    };

    // Log entry
    const logData: Record<string, any> = {
      tenant_id,
      customer_name: customer_name || null,
      customer_phone: customer_phone || "",
      message_type: message_type || "order_confirmation",
      message_content: messageText,
      status: "pending",
      reference_id: order_code || receipt_code || null,
      reference_type: message_type === "export_confirmation" ? "export" : "order",
      zns_template_id: znsTemplateId || null,
      retry_count: 0,
    };

    const { data: logEntry } = await supabaseAdmin
      .from("zalo_message_logs")
      .insert([logData])
      .select("id")
      .single();

    const logId = logEntry?.id;

    // Strategy: Try CS message first if follower found, otherwise try ZNS
    if (!recipientUserId && message_type === "test") {
      // Try sending to multiple recent followers until one accepts
      console.log("Test: trying CS to multiple recent followers...");
      const tryResult = await trySendCSToRecentFollowers(
        settings.zalo_access_token,
        messageText,
        10,
      );
      if (tryResult.userId) {
        if (logId) {
          await supabaseAdmin.from("zalo_message_logs").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            zalo_response: tryResult.result,
          }).eq("id", logId);
        }
        return new Response(
          JSON.stringify({ success: true, message: "Test sent successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // All followers failed
      if (logId) {
        await supabaseAdmin.from("zalo_message_logs").update({
          status: "failed",
          error_message: tryResult.result?.message || "Không có follower tương tác gần đây",
          zalo_response: tryResult.result,
        }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({
          error: "Gửi test thất bại",
          details: tryResult.result?.message || "Không có follower nào tương tác OA trong 7 ngày gần đây. Hãy nhắn tin cho OA từ Zalo rồi thử lại.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (recipientUserId) {
      console.log("Sending CS to user_id:", recipientUserId, "type:", typeof recipientUserId, "length:", recipientUserId.length);
      // Send CS message
      const zaloResponse = await fetch(
        "https://openapi.zalo.me/v3.0/oa/message/cs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: settings.zalo_access_token,
          },
          body: JSON.stringify({
            recipient: { user_id: recipientUserId },
            message: { text: messageText },
          }),
        }
      );

      const zaloResult = await zaloResponse.json();
      console.log("Zalo CS result:", JSON.stringify(zaloResult));

      if (zaloResult.error && zaloResult.error !== 0) {
        // CS by user_id failed — try CS by phone number first
        if (customer_phone) {
          console.log("CS by user_id failed, trying CS by phone...");
          const csByPhone = await sendCSByPhone(
            settings.zalo_oa_id,
            settings.zalo_access_token,
            zaloAppCreds?.app_secret || "",
            customer_phone,
            messageText,
            znsTemplateId,
          );
          if (csByPhone.success) {
            if (logId) {
              await supabaseAdmin.from("zalo_message_logs").update({
                status: "sent",
                sent_at: new Date().toISOString(),
                message_content: messageText + " [via CS-phone]",
                zalo_response: csByPhone.result,
              }).eq("id", logId);
            }
            return new Response(
              JSON.stringify({ success: true, message: "Sent via CS by phone" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.log("CS by phone also failed:", JSON.stringify(csByPhone.result));
        }

        // CS failed, try ZNS if available
        if (znsTemplateId && customer_phone) {
          console.log("CS failed, trying ZNS fallback...");
          const { result: znsResult, attempts } = await sendZNSWithRetry(
            settings.zalo_access_token,
            customer_phone,
            znsTemplateId,
            znsTemplateData
          );

          if (znsResult.error && znsResult.error !== 0) {
            if (logId) {
              await supabaseAdmin.from("zalo_message_logs").update({
                status: "failed",
                error_message: `CS: ${zaloResult.message}; ZNS: ${znsResult.message}`,
                error_code: String(znsResult.error),
                retry_count: attempts,
                zalo_response: znsResult,
              }).eq("id", logId);
            }
            return new Response(
              JSON.stringify({ error: "Gửi thất bại", details: `CS: ${zaloResult.message || 'N/A'}; ZNS: ${znsResult.message || 'N/A'}` }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (logId) {
            await supabaseAdmin.from("zalo_message_logs").update({
              status: "sent",
              sent_at: new Date().toISOString(),
              message_content: messageText + " [via ZNS]",
              retry_count: attempts,
              zalo_response: znsResult,
            }).eq("id", logId);
          }
          return new Response(
            JSON.stringify({ success: true, message: "Sent via ZNS" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // No ZNS fallback
        if (logId) {
          await supabaseAdmin.from("zalo_message_logs").update({
            status: "failed",
            error_message: zaloResult.message || "Unknown error",
            error_code: String(zaloResult.error),
            zalo_response: zaloResult,
          }).eq("id", logId);
        }

        let friendlyError = zaloResult.message || "Lỗi không xác định";
        if (customer_phone && !znsTemplateId) {
          friendlyError = "Khách chưa tương tác OA trong 7 ngày và cửa hàng chưa cấu hình template gửi theo số điện thoại/ZNS.";
        }
        if (zaloResult.error === -124 || zaloResult.error === -216) {
          friendlyError = "Access Token không hợp lệ hoặc đã hết hạn.";
        } else if (zaloResult.error === -201 || zaloResult.error === -213) {
          friendlyError = "Người nhận chưa tương tác với OA trong 7 ngày qua.";
        } else if (zaloResult.error === -230 && customer_phone && !znsTemplateId) {
          friendlyError = "Người nhận chưa tương tác OA trong 7 ngày và chưa có template fallback theo số điện thoại.";
        }

        return new Response(
          JSON.stringify({ error: "Zalo gửi thất bại", details: friendlyError, zalo_error_code: zaloResult.error }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // CS success
      if (logId) {
        await supabaseAdmin.from("zalo_message_logs").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          zalo_response: zaloResult,
        }).eq("id", logId);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Zalo CS message sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No follower found — try CS by phone first, then ZNS
    if (customer_phone && message_type !== "test") {
      console.log("No follower found, trying CS by phone...");
      const csByPhone = await sendCSByPhone(
        settings.zalo_oa_id,
        settings.zalo_access_token,
        zaloAppCreds?.app_secret || "",
        customer_phone,
        messageText,
        znsTemplateId,
      );
      if (csByPhone.success) {
        if (logId) {
          await supabaseAdmin.from("zalo_message_logs").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            message_content: messageText + " [via CS-phone]",
            zalo_response: csByPhone.result,
          }).eq("id", logId);
        }
        return new Response(
          JSON.stringify({ success: true, message: "Sent via CS by phone" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("CS by phone failed:", JSON.stringify(csByPhone.result));
    }

    // Try ZNS as last resort
    if (znsTemplateId && customer_phone && message_type !== "test") {
      const { result: znsResult, attempts } = await sendZNSWithRetry(
        settings.zalo_access_token,
        customer_phone,
        znsTemplateId,
        znsTemplateData
      );

      if (znsResult.error && znsResult.error !== 0) {
        if (logId) {
          await supabaseAdmin.from("zalo_message_logs").update({
            status: "failed",
            error_message: znsResult.message || "ZNS error",
            error_code: String(znsResult.error),
            retry_count: attempts,
            zalo_response: znsResult,
          }).eq("id", logId);
        }

        let friendlyError = znsResult.message || "Lỗi ZNS";
        if (znsResult.error === -124) {
          friendlyError = "Access Token hết hạn. Vui lòng lấy token mới.";
        }

        return new Response(
          JSON.stringify({ error: "ZNS gửi thất bại", details: friendlyError }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (logId) {
        await supabaseAdmin.from("zalo_message_logs").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_content: messageText + " [via ZNS]",
          retry_count: attempts,
          zalo_response: znsResult,
        }).eq("id", logId);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Sent via ZNS" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No follower and no ZNS — skip
    if (logId) {
      await supabaseAdmin.from("zalo_message_logs").update({
        status: "skipped",
        error_message: "Khách chưa follow OA và chưa cấu hình ZNS Template",
      }).eq("id", logId);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Customer not follower, no ZNS configured, skipped" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Zalo send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
