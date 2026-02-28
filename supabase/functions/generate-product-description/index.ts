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

    const systemPrompt = `Bạn là chuyên gia viết mô tả sản phẩm cho website bán hàng Việt Nam. Viết mô tả chuyên nghiệp, hấp dẫn, chuẩn SEO.

Ngành nghề: ${businessType || 'Cửa hàng điện thoại'}
Tên cửa hàng: ${storeName || 'Shop'}

Yêu cầu:
- Viết bằng tiếng Việt
- HTML format (dùng <h3>, <p>, <ul>, <li>, <strong>)
- Bao gồm: Giới thiệu sản phẩm, Điểm nổi bật, Thông số chính (nếu biết), Lý do nên mua
- Phong cách chuyên nghiệp, thuyết phục
- Nếu là điện thoại: nhấn mạnh camera, hiệu năng, pin, màn hình
- Nếu là thời trang: nhấn mạnh chất liệu, phong cách, phù hợp dịp nào
- Nếu là mỹ phẩm/spa: nhấn mạnh thành phần, công dụng, an toàn
- Độ dài khoảng 200-400 từ`;

    const userPrompt = `Viết mô tả sản phẩm cho:
- Tên: ${productName}
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
        model: "google/gemini-2.5-flash",
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
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(jsonMatch[0], {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ description: content, seo_title: "", seo_description: "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
