import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productName, sku, categoryName, salePrice, storeName, businessType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ========== BƯỚC 1: XÁC MINH SẢN PHẨM CHÍNH XÁC ==========
    const verifyPrompt = `Bạn là chuyên gia nhận dạng sản phẩm. Dựa trên tên sản phẩm và mã SKU, hãy xác định CHÍNH XÁC sản phẩm này là gì.

Tên sản phẩm: "${productName}"
SKU: "${sku || 'N/A'}"
Danh mục: "${categoryName || 'N/A'}"

YÊU CẦU QUAN TRỌNG:
- Xác định ĐÚNG model, ĐÚNG phiên bản (ví dụ: iPhone 13 KHÁC iPhone 13 Pro, iPhone 13 Pro Max)
- Nếu là điện thoại: xác định đúng dòng máy, năm ra mắt, thông số chính (chip, camera, màn hình, pin)
- Nếu là laptop/tablet: xác định đúng model, cấu hình
- Nếu là thời trang/mỹ phẩm: xác định đúng loại sản phẩm, thương hiệu
- KHÔNG được nhầm lẫn giữa các model gần giống nhau
- Trả về tên đầy đủ chính xác nhất của sản phẩm

Trả về JSON format:
{
  "verified_name": "Tên sản phẩm đầy đủ chính xác (ví dụ: Apple iPhone 13 128GB)",
  "product_type": "phone|laptop|tablet|fashion|cosmetic|accessory|other",
  "brand": "Thương hiệu",
  "key_specs": "Thông số chính ngắn gọn (chip, camera, RAM, màn hình...)",
  "year_released": "Năm ra mắt (nếu biết)",
  "design_features": "Mô tả ngắn về thiết kế bên ngoài để tạo ảnh chính xác (màu sắc phổ biến, hình dáng, notch/dynamic island, số camera sau...)"
}`;

    const verifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: verifyPrompt }],
        tools: [
          {
            type: "function",
            function: {
              name: "verify_product",
              description: "Return verified product information",
              parameters: {
                type: "object",
                properties: {
                  verified_name: { type: "string" },
                  product_type: { type: "string" },
                  brand: { type: "string" },
                  key_specs: { type: "string" },
                  year_released: { type: "string" },
                  design_features: { type: "string" },
                },
                required: ["verified_name", "product_type", "brand", "key_specs", "design_features"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "verify_product" } },
      }),
    });

    let verifiedInfo = {
      verified_name: productName,
      product_type: "other",
      brand: "",
      key_specs: "",
      year_released: "",
      design_features: "",
    };

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const toolCall = verifyData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          verifiedInfo = { ...verifiedInfo, ...JSON.parse(toolCall.function.arguments) };
          console.log("Verified product:", verifiedInfo.verified_name);
        } catch { /* keep default */ }
      }
    } else {
      console.error("Verify step failed, using original name:", verifyResponse.status);
      await verifyResponse.text(); // consume body
    }

    // ========== BƯỚC 2: TẠO MÔ TẢ DỰA TRÊN THÔNG TIN ĐÃ XÁC MINH ==========
    const systemPrompt = `Bạn là chuyên gia viết mô tả sản phẩm cho website bán hàng Việt Nam. Viết mô tả chuyên nghiệp, hấp dẫn, chuẩn SEO.

Ngành nghề: ${businessType || 'Cửa hàng điện thoại'}
Tên cửa hàng: ${storeName || 'Shop'}

THÔNG TIN SẢN PHẨM ĐÃ XÁC MINH:
- Tên chính xác: ${verifiedInfo.verified_name}
- Loại: ${verifiedInfo.product_type}
- Thương hiệu: ${verifiedInfo.brand}
- Thông số chính: ${verifiedInfo.key_specs}
- Năm ra mắt: ${verifiedInfo.year_released || 'N/A'}

Yêu cầu:
- Viết bằng tiếng Việt
- HTML format (dùng <h3>, <p>, <ul>, <li>, <strong>)
- Bao gồm: Giới thiệu sản phẩm, Điểm nổi bật, Thông số chính, Lý do nên mua
- Phong cách chuyên nghiệp, thuyết phục
- SỬ DỤNG ĐÚNG thông số đã xác minh, KHÔNG bịa thông số
- Độ dài khoảng 200-400 từ`;

    const userPrompt = `Viết mô tả sản phẩm cho:
- Tên chính xác: ${verifiedInfo.verified_name}
- Mã: ${sku || 'N/A'}
- Danh mục: ${categoryName || 'Chung'}
- Giá bán: ${salePrice ? new Intl.NumberFormat('vi-VN').format(salePrice) + 'đ' : 'Liên hệ'}

Đồng thời tạo thêm:
1. Tiêu đề SEO (tối đa 60 ký tự, có từ khóa chính)
2. Mô tả SEO (tối đa 160 ký tự)

Trả về JSON format:
{"description": "...", "seo_title": "...", "seo_description": "..."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_product_content",
              description: "Return product description and SEO metadata",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string", description: "HTML product description" },
                  seo_title: { type: "string", description: "SEO title max 60 chars" },
                  seo_description: { type: "string", description: "SEO description max 160 chars" },
                },
                required: ["description", "seo_title", "seo_description"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_product_content" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Đang quá tải, vui lòng thử lại sau." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Hết lượt sử dụng AI, vui lòng nạp thêm credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    
    // Extract from tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      // Include verified info so frontend can pass it to image generation
      return new Response(JSON.stringify({
        ...parsed,
        verified_name: verifiedInfo.verified_name,
        design_features: verifiedInfo.design_features,
        product_type: verifiedInfo.product_type,
        brand: verifiedInfo.brand,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify({
        ...parsed,
        verified_name: verifiedInfo.verified_name,
        design_features: verifiedInfo.design_features,
        product_type: verifiedInfo.product_type,
        brand: verifiedInfo.brand,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      description: content,
      seo_title: "",
      seo_description: "",
      verified_name: verifiedInfo.verified_name,
      design_features: verifiedInfo.design_features,
      product_type: verifiedInfo.product_type,
      brand: verifiedInfo.brand,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
