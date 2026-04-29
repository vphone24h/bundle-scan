import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReviewItem {
  customer_name: string;
  content: string;
  rating: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const productName: string = String(body?.product_name || "").trim();
    const counts: Record<string, number> = body?.counts || {};
    const existingNames: string[] = Array.isArray(body?.existing_names)
      ? body.existing_names.slice(0, 200)
      : [];

    if (!productName) {
      return new Response(
        JSON.stringify({ error: "Thiếu tên sản phẩm" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const star1 = Math.max(0, Math.min(50, Number(counts["1"]) || 0));
    const star2 = Math.max(0, Math.min(50, Number(counts["2"]) || 0));
    const star3 = Math.max(0, Math.min(50, Number(counts["3"]) || 0));
    const star4 = Math.max(0, Math.min(50, Number(counts["4"]) || 0));
    const star5 = Math.max(0, Math.min(50, Number(counts["5"]) || 0));
    const total = star1 + star2 + star3 + star4 + star5;

    if (total === 0) {
      return new Response(
        JSON.stringify({ error: "Vui lòng nhập số lượng đánh giá > 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Bạn là trợ lý chuyên sinh review sản phẩm Tiếng Việt cực kỳ tự nhiên, giống người thật ở Việt Nam (đặc biệt thế hệ 7x, 8x, 9x). Bạn luôn trả về dữ liệu qua tool calling.

QUY TẮC SINH NỘI DUNG:
- Mỗi review 1 câu ngắn từ 5 đến 25 từ, cảm xúc tự nhiên, không sến súa, không quảng cáo lộ liễu.
- KHÔNG dùng emoji ở đa số (chỉ ~10% review có emoji nhẹ như 😍, 👍, ❤️).
- Phong cách 7x/8x: viết tắt thoải mái (k = không, đc = được, ng = người, vs = với, mn = mọi người, ms = mới, h = giờ, j = gì), thi thoảng sai chính tả nhẹ (giàu -> giàu, nhân viên -> nhâ viên, được -> đk, lắm -> lắmm, quá -> wá, dùng -> dug), hoặc thiếu dấu thanh.
- Tên người (customer_name): đa dạng tên Việt Nam thật (Hùng, Linh, Minh, Trang, Thảo, Vy, An, Dũng, Phương, Tú, Lan, Hà, Nam, Quân, Hiền, Tuấn, Yến, Loan, Nga, Hạnh, Thúy, Dung, Khánh...). Có thể chỉ tên (Hùng), hoặc Họ Tên (Nguyễn Văn Hùng), hoặc kiểu nickname trẻ trung (Hùng Nguyễn, Linh Trần, Mèo Con, Bé Bống, Anh Tùng, Chị Hà...). KHÔNG ĐƯỢC TRÙNG nhau và KHÔNG TRÙNG với danh sách tên đã có.
- Nội dung phù hợp với SỐ SAO:
  * 5 sao: rất hài lòng, khen máy đẹp/giá tốt/giao nhanh/nhân viên nhiệt tình.
  * 4 sao: hài lòng nhưng có chút góp ý nhỏ (pin tạm ổn, hộp hơi cũ, giao hơi lâu chút...).
  * 3 sao: bình thường, tạm được, có vài điểm chưa ưng.
  * 2 sao: thất vọng nhẹ, máy có vấn đề nhỏ, mong shop cải thiện.
  * 1 sao: bực, máy lỗi/giao sai/ tư vấn kém, nhưng KHÔNG chửi tục.
- Đa dạng nội dung, KHÔNG lặp ý, KHÔNG dùng cùng câu mở đầu.
- Liên hệ tới sản phẩm "${productName}" tự nhiên (có thể nhắc tên ngắn gọn vài lần, không nhắc hết).`;

    const userPrompt = `Sinh đúng ${total} đánh giá cho sản phẩm: "${productName}".
Phân bổ:
- 5 sao: ${star5}
- 4 sao: ${star4}
- 3 sao: ${star3}
- 2 sao: ${star2}
- 1 sao: ${star1}

${existingNames.length > 0 ? `Các tên ĐÃ TỒN TẠI (tuyệt đối không trùng): ${existingNames.join(", ")}` : ""}

Trả về qua tool "submit_reviews".`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
                name: "submit_reviews",
                description: "Trả về danh sách review đã sinh.",
                parameters: {
                  type: "object",
                  properties: {
                    reviews: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          customer_name: { type: "string" },
                          content: { type: "string" },
                          rating: { type: "integer", minimum: 1, maximum: 5 },
                        },
                        required: ["customer_name", "content", "rating"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["reviews"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "submit_reviews" },
          },
        }),
      },
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI đang quá tải, vui lòng thử lại sau ít phút." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Hết credits AI, liên hệ admin để nạp thêm." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "AI gateway lỗi" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments || "{}";
    let parsed: { reviews?: ReviewItem[] } = {};
    try {
      parsed = JSON.parse(argsStr);
    } catch (e) {
      console.error("Parse tool args failed", e, argsStr);
    }

    const reviews = Array.isArray(parsed.reviews) ? parsed.reviews : [];

    // De-dup tên trong batch (tránh AI lỡ trùng)
    const seen = new Set<string>(existingNames.map(n => n.toLowerCase().trim()));
    const cleaned: ReviewItem[] = [];
    for (const r of reviews) {
      let name = String(r?.customer_name || "").trim();
      const content = String(r?.content || "").trim();
      const rating = Math.max(1, Math.min(5, Number(r?.rating) || 5));
      if (!name || !content) continue;
      let key = name.toLowerCase();
      let suffix = 1;
      while (seen.has(key)) {
        suffix += 1;
        name = `${r.customer_name} ${suffix}`;
        key = name.toLowerCase();
      }
      seen.add(key);
      cleaned.push({ customer_name: name, content, rating });
    }

    return new Response(
      JSON.stringify({ reviews: cleaned }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-fake-reviews error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});