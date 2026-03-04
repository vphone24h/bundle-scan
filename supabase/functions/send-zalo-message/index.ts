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
      .select("zalo_oa_id, zalo_access_token, zalo_enabled, store_name, store_phone")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Tenant settings not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If Zalo is not enabled, skip silently
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

    // Get branch hotline if available
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

    // Build message content based on type
    let messageText = "";

    if (message_type === "test") {
      messageText = `Xin chào! Đây là tin nhắn test từ ${storeName}. Cấu hình Zalo OA đã hoạt động thành công! ✅`;
    } else if (message_type === "order_confirmation") {
      const priceFormatted = product_price
        ? new Intl.NumberFormat("vi-VN").format(product_price) + "đ"
        : "";
      messageText =
        `Xin chào ${customer_name || "bạn"},\n\n` +
        `Cảm ơn bạn đã đặt hàng tại ${storeName}.\n\n` +
        `Đơn hàng của bạn đã được ghi nhận:\n` +
        `📦 Sản phẩm: ${product_name || ""}\n` +
        `🔢 Mã đơn hàng: ${order_code || ""}\n` +
        (priceFormatted ? `💰 Giá: ${priceFormatted}\n` : "") +
        `\nCửa hàng sẽ liên hệ với bạn sớm nhất.` +
        (hotline ? `\n📞 Hotline: ${hotline}` : "");
    } else if (message_type === "export_confirmation") {
      const totalFormatted = total_amount
        ? new Intl.NumberFormat("vi-VN").format(total_amount) + "đ"
        : "";
      let itemsText = "";
      if (items && items.length > 0) {
        itemsText = items
          .map(
            (item: any, i: number) =>
              `${i + 1}. ${item.product_name}${item.imei ? ` (IMEI: ${item.imei})` : ""}${item.warranty ? ` - BH: ${item.warranty}` : ""}`
          )
          .join("\n");
      }
      messageText =
        `Xin chào ${customer_name || "bạn"},\n\n` +
        `Cảm ơn bạn đã mua hàng tại ${storeName}! 🎉\n\n` +
        `Chi tiết đơn hàng${receipt_code ? ` ${receipt_code}` : ""}:\n` +
        (itemsText ? `${itemsText}\n` : "") +
        (totalFormatted ? `\n💰 Tổng tiền: ${totalFormatted}\n` : "") +
        `\nChúc bạn sử dụng sản phẩm vui vẻ!` +
        (hotline ? `\n📞 Hotline hỗ trợ: ${hotline}` : "");
    }

    if (!messageText) {
      return new Response(
        JSON.stringify({ error: "Invalid message_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone for Zalo: convert 0xxx to 84xxx
    let zaloPhone = (customer_phone || "").replace(/\s/g, "");
    if (zaloPhone.startsWith("0")) {
      zaloPhone = "84" + zaloPhone.substring(1);
    }

    // Log the message attempt
    const logData = {
      tenant_id,
      customer_name: customer_name || null,
      customer_phone: customer_phone || "",
      message_type: message_type || "order_confirmation",
      message_content: messageText,
      status: "pending",
      reference_id: order_code || receipt_code || null,
      reference_type: message_type === "export_confirmation" ? "export" : "order",
    };

    const { data: logEntry } = await supabaseAdmin
      .from("zalo_message_logs")
      .insert([logData])
      .select("id")
      .single();

    const logId = logEntry?.id;

    // Send message via Zalo OA API
    const zaloResponse = await fetch(
      "https://openapi.zalo.me/v3.0/oa/message/cs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: settings.zalo_access_token,
        },
        body: JSON.stringify({
          recipient: { user_id: zaloPhone },
          message: { text: messageText },
        }),
      }
    );

    const zaloResult = await zaloResponse.json();

    // If Zalo returns error with user_id approach, try phone-based ZNS
    if (zaloResult.error && zaloResult.error !== 0) {
      const znsResponse = await fetch(
        "https://business.openapi.zalo.me/message/template",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: settings.zalo_access_token,
          },
          body: JSON.stringify({
            phone: zaloPhone,
            template_id: "0",
            template_data: { content: messageText },
          }),
        }
      );

      const znsResult = await znsResponse.json();
      console.log("Zalo ZNS result:", JSON.stringify(znsResult));

      if (znsResult.error && znsResult.error !== 0) {
        // Update log with error
        if (logId) {
          await supabaseAdmin
            .from("zalo_message_logs")
            .update({
              status: "failed",
              error_message: znsResult.message || zaloResult.message || "Unknown error",
              error_code: String(znsResult.error || zaloResult.error),
            })
            .eq("id", logId);
        }

        return new Response(
          JSON.stringify({
            error: "Zalo send failed",
            details: znsResult.message || zaloResult.message || "Unknown error",
            zalo_error_code: znsResult.error || zaloResult.error,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update log as success
    if (logId) {
      await supabaseAdmin
        .from("zalo_message_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Zalo message sent" }),
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
