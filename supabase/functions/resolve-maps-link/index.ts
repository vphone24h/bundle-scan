import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractCoords(text: string): { lat: number; lng: number } | null {
  for (const p of [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/, /(-?\d{1,2}\.\d{5,}),\s*(\d{2,3}\.\d{5,})/]) {
    const m = text.match(p);
    if (m) { const lat = parseFloat(m[1]), lng = parseFloat(m[2]); if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng }; }
  }
  return null;
}

function ok(d: Record<string, unknown>) { return new Response(JSON.stringify(d), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url) return ok({ error: "Missing url" });

    // For share.google links, we can't resolve (Google blocks with CAPTCHA)
    if (url.includes("share.google")) {
      return ok({ error: "unsupported_link", message: "Link share.google không hỗ trợ. Vui lòng mở Google Maps → nhấn vào địa chỉ → copy tọa độ (VD: 10.867357, 106.805219)" });
    }

    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" } });
    const finalUrl = res.url;

    const c = extractCoords(finalUrl);
    if (c) return ok(c);

    // Try extracting from body
    const body = await res.text();
    const fromBody = extractCoords(body);
    if (fromBody) return ok(fromBody);

    return ok({ error: "no_coords", message: "Không tìm thấy tọa độ trong link." });
  } catch (e) {
    return ok({ error: (e as Error).message });
  }
});
