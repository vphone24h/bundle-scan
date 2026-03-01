import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productName, categoryName, businessType, tenantId, imageCount = 1 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Determine product type for better prompts
    const isPhone = businessType === 'phone_store' || /phone|điện thoại|iphone|samsung|xiaomi|oppo|vivo/i.test(productName);
    const isFashion = businessType === 'fashion' || /áo|quần|váy|giày|túi|thời trang/i.test(productName);

    const imagePrompts: string[] = [];

    // Cover image - hero shot
    if (isPhone) {
      imagePrompts.push(
        `Professional product photography of ${productName} smartphone, front view on clean white background, studio lighting, ultra high resolution, e-commerce product photo, 4:3 aspect ratio`,
      );
      // Different color variants and angles
      imagePrompts.push(
        `${productName} smartphone shown from back side, elegant product photography, studio lighting on gradient background, showcasing design and camera module, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} smartphone held in hand, lifestyle photography, bokeh background, natural lighting, showing screen display, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} smartphone close-up on camera system detail, macro product photography, studio lighting, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} smartphone from 45 degree angle on sleek surface, reflections, premium product photography, ultra high resolution`,
      );
    } else if (isFashion) {
      imagePrompts.push(
        `Professional fashion product photography of ${productName}, flat lay on white background, studio lighting, e-commerce style, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} fashion item detail close-up, showing fabric texture and quality, studio macro photography, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} styled outfit photography, lifestyle shot, natural lighting, fashion editorial style, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} fashion item from different angle, hanging on minimal hanger, clean background, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} in different color variant, professional product photography, white background, ultra high resolution`,
      );
    } else {
      imagePrompts.push(
        `Professional product photography of ${productName}, front view on clean white background, studio lighting, e-commerce product photo, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} product from back/side angle, professional studio photography, gradient background, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} product lifestyle photography, in-use scenario, natural lighting, attractive composition, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} close-up detail shot, showing product quality and features, macro photography, ultra high resolution`,
      );
      imagePrompts.push(
        `${productName} product from 45 degree angle, premium studio photography, clean background, ultra high resolution`,
      );
    }

    const actualCount = Math.min(imageCount, imagePrompts.length);
    const prompts = imagePrompts.slice(0, actualCount);

    const imageUrls: string[] = [];

    for (let i = 0; i < prompts.length; i++) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: prompts[i] }],
            modalities: ["image", "text"],
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            console.error("Rate limited at image", i);
            // Wait a bit and continue
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          if (aiResponse.status === 402) {
            return new Response(JSON.stringify({ 
              error: "Hết lượt sử dụng AI, vui lòng nạp thêm credits.",
              images: imageUrls 
            }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const t = await aiResponse.text();
          console.error(`AI image error ${i}:`, aiResponse.status, t);
          continue;
        }

        const aiData = await aiResponse.json();
        const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (!imageData) {
          console.error(`No image data returned for prompt ${i}`);
          continue;
        }

        // Extract base64 data
        const base64Match = imageData.match(/^data:image\/(.*?);base64,(.*)$/);
        if (!base64Match) {
          console.error(`Invalid image format for prompt ${i}`);
          continue;
        }

        const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
        const base64Data = base64Match[2];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        // Upload to storage
        const fileName = `${tenantId}/ai-gen/${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('landing-assets')
          .upload(fileName, binaryData, {
            contentType: `image/${base64Match[1]}`,
            upsert: false,
          });

        if (uploadError) {
          console.error(`Upload error for image ${i}:`, uploadError);
          continue;
        }

        const { data: publicUrl } = supabase.storage
          .from('landing-assets')
          .getPublicUrl(fileName);
        
        imageUrls.push(publicUrl.publicUrl);

        // Small delay between requests to avoid rate limiting
        if (i < prompts.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (imgError) {
        console.error(`Error generating image ${i}:`, imgError);
        continue;
      }
    }

    return new Response(JSON.stringify({ images: imageUrls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
