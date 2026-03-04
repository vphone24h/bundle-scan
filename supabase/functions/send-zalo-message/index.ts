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

// Get the first follower from OA's follower list (for test mode)
async function getFirstFollower(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://openapi.zalo.me/v3.0/oa/user/getlist?offset=0&count=1", {
      method: "GET",
      headers: { access_token: accessToken },
    });
    const data = await res.json();
    console.log("Zalo getlist result:", JSON.stringify(data));
    if (data.error === 0 && data.data?.users?.length > 0) {
      return data.data.users[0].user_id;
    }
    if (data.data?.total > 0 && data.data?.followers?.length > 0) {
      return data.data.followers[0].user_id;
    }
    return null;
  } catch (e) {
    console.error("Error getting followers:", e);
    return null;
  }
}

// Send ZNS message to phone number (for non-followers)
async function sendZNS(accessToken: string, phone: string, templateId: string, templateData: Record<string, string>): Promise<any> {
  const phone84 = normalizePhoneTo84(phone);
  console.log("Sending ZNS to:", phone84, "template:", templateId);
  
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
  console.log("ZNS response:", JSON.stringify(data));
  return data;
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

    // Build message content (for CS messages)
    const messageText = buildMessageText({
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
      if (!recipientUserId) {
        recipientUserId = await getFirstFollower(settings.zalo_access_token);
      }
      if (!recipientUserId) {
        return new Response(
          JSON.stringify({
            error: "Không tìm thấy người theo dõi OA",
            details: "Để test, bạn cần quan tâm (follow) OA trên Zalo trước, sau đó nhắn 1 tin nhắn cho OA.",
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // For production messages: try to find user by phone in zalo_followers table
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

    // Log entry
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

    // Strategy: Try CS message first if follower found, otherwise try ZNS
    if (recipientUserId) {
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
        // CS failed, try ZNS if available
        if (settings.zalo_zns_template_id && customer_phone && message_type !== "test") {
          console.log("CS failed, trying ZNS fallback...");
          const znsResult = await sendZNS(
            settings.zalo_access_token,
            customer_phone,
            settings.zalo_zns_template_id,
            {
              customer_name: customer_name || "Quý khách",
              order_code: order_code || receipt_code || "",
              store_name: storeName,
              hotline: hotline,
              amount: total_amount ? new Intl.NumberFormat("vi-VN").format(total_amount) + "đ" : "",
            }
          );

          if (znsResult.error && znsResult.error !== 0) {
            if (logId) {
              await supabaseAdmin.from("zalo_message_logs").update({
                status: "failed",
                error_message: `CS: ${zaloResult.message}; ZNS: ${znsResult.message}`,
                error_code: String(znsResult.error),
              }).eq("id", logId);
            }
            return new Response(
              JSON.stringify({ error: "Gửi thất bại", details: znsResult.message || zaloResult.message }),
              { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // ZNS success
          if (logId) {
            await supabaseAdmin.from("zalo_message_logs").update({
              status: "sent",
              sent_at: new Date().toISOString(),
              message_content: messageText + " [via ZNS]",
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
          }).eq("id", logId);
        }

        let friendlyError = zaloResult.message || "Lỗi không xác định";
        if (zaloResult.error === -124 || zaloResult.error === -216) {
          friendlyError = "Access Token không hợp lệ hoặc đã hết hạn.";
        } else if (zaloResult.error === -201 || zaloResult.error === -213) {
          friendlyError = "Người nhận chưa tương tác với OA trong 7 ngày qua.";
        }

        return new Response(
          JSON.stringify({ error: "Zalo send failed", details: friendlyError, zalo_error_code: zaloResult.error }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // CS success
      if (logId) {
        await supabaseAdmin.from("zalo_message_logs").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", logId);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Zalo CS message sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No follower found — try ZNS directly
    if (settings.zalo_zns_template_id && customer_phone && message_type !== "test") {
      const znsResult = await sendZNS(
        settings.zalo_access_token,
        customer_phone,
        settings.zalo_zns_template_id,
        {
          customer_name: customer_name || "Quý khách",
          order_code: order_code || receipt_code || "",
          store_name: storeName,
          hotline: hotline,
          amount: total_amount ? new Intl.NumberFormat("vi-VN").format(total_amount) + "đ" : "",
        }
      );

      if (znsResult.error && znsResult.error !== 0) {
        if (logId) {
          await supabaseAdmin.from("zalo_message_logs").update({
            status: "failed",
            error_message: znsResult.message || "ZNS error",
            error_code: String(znsResult.error),
          }).eq("id", logId);
        }

        let friendlyError = znsResult.message || "Lỗi ZNS";
        if (znsResult.error === -124) {
          friendlyError = "Access Token hết hạn. Vui lòng lấy token mới.";
        }

        return new Response(
          JSON.stringify({ error: "ZNS send failed", details: friendlyError }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (logId) {
        await supabaseAdmin.from("zalo_message_logs").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_content: messageText + " [via ZNS]",
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
