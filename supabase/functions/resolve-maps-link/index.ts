import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractCoords(text: string): { lat: number; lng: number } | null {
  for (const p of [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/]) {
    const m = text.match(p);
    if (m) { const lat = parseFloat(m[1]), lng = parseFloat(m[2]); if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng }; }
  }
  return null;
}

async function geocode(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=vn`, { headers: { "User-Agent": "VKHO/1.0" } });
    const d = await r.json();
    if (d?.length) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), address: d[0].display_name };
  } catch (_) {}
  return null;
}

function ok(d: Record<string, unknown>) { return new Response(JSON.stringify(d), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" } });
    const finalUrl = res.url;
    const c = extractCoords(finalUrl);
    if (c) return ok(c);

    // Fully decode the URL to extract place name
    let decoded = finalUrl;
    for (let i = 0; i < 5; i++) { try { const n = decodeURIComponent(decoded); if (n === decoded) break; decoded = n; } catch { break; } }
    decoded = decoded.replace(/\+/g, " ");

    // Find all q= params in decoded URL, skip captcha tokens
    let placeName = "";
    for (const m of decoded.matchAll(/[?&]q=([^&]{4,200})/g)) {
      const v = m[1].trim();
      if (/^[A-Za-z0-9_\-]{30,}$/.test(v)) continue; // captcha token
      if (/^Eh[A-Za-z0-9]/.test(v) && v.length > 40) continue;
      placeName = v; break;
    }

    if (placeName) {
      const quanMatch = placeName.match(/Quận\s*\d+/i);
      if (quanMatch) {
        const r = await geocode(`${quanMatch[0]}, Thủ Đức, Hồ Chí Minh`);
        if (r) return ok({ ...r, placeName, approximate: true });
        const r2 = await geocode(`${quanMatch[0]}, Hồ Chí Minh`);
        if (r2) return ok({ ...r2, placeName, approximate: true });
      }
      const r = await geocode(placeName);
      if (r) return ok({ ...r, placeName, approximate: true });
    }

    return new Response(JSON.stringify({ error: "no_coords", resolvedUrl: finalUrl, placeName, decoded: decoded.substring(0, 500) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
