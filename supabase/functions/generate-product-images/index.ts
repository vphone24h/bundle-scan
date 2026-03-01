import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productName, categoryName, businessType, tenantId, imageCount = 1, verifiedName, designFeatures, productType, brand } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use verified name if available, otherwise fall back to original
    const exactName = verifiedName || productName;
    const features = designFeatures || '';
    const type = productType || (businessType === 'phone_store' ? 'phone' : 'other');

    // Build highly specific prompt based on verified product info
    let imagePrompt: string;

    if (type === 'phone') {
      imagePrompt = `Professional e-commerce product photography of exactly "${exactName}" smartphone. ${features ? `Design details: ${features}.` : ''} ${brand ? `Brand: ${brand}.` : ''} Front view showing the screen, on a clean white background. Studio lighting, sharp focus, high resolution. The phone must look EXACTLY like the real "${exactName}" - correct notch/dynamic island style, correct camera layout, correct body shape. Do NOT show any other phone model. 4:3 aspect ratio, ultra high resolution.`;
    } else if (type === 'fashion') {
      imagePrompt = `Professional fashion product photography of "${exactName}". ${features ? `Details: ${features}.` : ''} Flat lay on white background, studio lighting, e-commerce style, showing fabric texture and design details clearly. Ultra high resolution.`;
    } else if (type === 'laptop' || type === 'tablet') {
      imagePrompt = `Professional product photography of exactly "${exactName}". ${features ? `Design: ${features}.` : ''} ${brand ? `Brand: ${brand}.` : ''} Open view showing screen and keyboard/body, on clean white background. Must look EXACTLY like the real product. Studio lighting, ultra high resolution.`;
    } else {
      imagePrompt = `Professional e-commerce product photography of "${exactName}". ${features ? `Details: ${features}.` : ''} ${brand ? `Brand: ${brand}.` : ''} Clean white background, studio lighting, sharp details, attractive composition. Ultra high resolution.`;
    }

    console.log("Generating image for:", exactName);
    console.log("Prompt:", imagePrompt);

    const imageUrls: string[] = [];

    const actualCount = Math.min(imageCount, 5);

    for (let i = 0; i < actualCount; i++) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            console.error("Rate limited at image", i);
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

        const base64Match = imageData.match(/^data:image\/(.*?);base64,(.*)$/);
        if (!base64Match) {
          console.error(`Invalid image format for prompt ${i}`);
          continue;
        }

        const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
        const base64Data = base64Match[2];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
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

        if (i < actualCount - 1) {
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
