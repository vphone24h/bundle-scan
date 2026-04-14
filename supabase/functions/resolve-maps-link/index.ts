import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractCoords(text: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
  }
  return null;
}

function extractPlaceNameFromUrl(url: string): string {
  // Approach: find q%3D or q= in the raw URL, extract the encoded value, then decode it
  // Match q%3D (inside encoded continue= param) - value ends at %26 or end of continue param
  const encodedQMatch = url.match(/q%3D((?:[^%]|%(?!26|3[dD]))+)/i);
  if (encodedQMatch) {
    try {
      // The value is double-encoded, decode twice
      let val = encodedQMatch[1];
      for (let i = 0; i < 3; i++) {
        try {
          const next = decodeURIComponent(val);
          if (next === val) break;
          val = next;
        } catch { break; }
      }
      val = val.replace(/\+/g, " ");
      if (val.length > 3 && val.length < 300 && !isCaptchaToken(val)) return val;
    } catch (_) {}
  }

  // Match regular q= (direct URL param)
  const qMatches = [...url.matchAll(/[?&]q=([^&]+)/g)];
  for (const m of qMatches) {
    try {
      let val = decodeURIComponent(m[1]).replace(/\+/g, " ");
      if (val.length > 3 && val.length < 300 && !isCaptchaToken(val)) return val;
    } catch (_) {}
  }
  return "";
}

function isCaptchaToken(val: string): boolean {
  if (val.startsWith("Eh") && val.length > 50) return true;
  if (/^[A-Za-z0-9_\-+/=]{40,}$/.test(val)) return true;
  return false;
}

async function geocodeNominatim(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=vn`,
      { headers: { "User-Agent": "VKHO-App/1.0" } }
    );
    const data = await res.json();
    if (data?.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), address: data[0].display_name };
    }
  } catch (_) {}
  return null;
}

function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" } });
    const finalUrl = res.url;

    const fromUrl = extractCoords(finalUrl);
    if (fromUrl) return ok(fromUrl);

    const placeName = extractPlaceNameFromUrl(finalUrl);

    if (placeName) {
      // Strategy 1: Extract "Quận X" and use with city
      const quanMatch = placeName.match(/Quận\s*\d+/i);

      if (quanMatch) {
        const result = await geocodeNominatim(`${quanMatch[0]}, Thủ Đức, Hồ Chí Minh`);
        if (result) return ok({ ...result, placeName, approximate: true });

        const result2 = await geocodeNominatim(`${quanMatch[0]}, Hồ Chí Minh`);
        if (result2) return ok({ ...result2, placeName, approximate: true });
      }

      // Strategy 2: Full name
      const result = await geocodeNominatim(placeName);
      if (result) return ok({ ...result, placeName, approximate: true });

      // Strategy 3: After dash
      const afterDash = placeName.split(/\s*[-–]\s*/).pop()?.trim();
      if (afterDash && afterDash !== placeName) {
        const result2 = await geocodeNominatim(afterDash);
        if (result2) return ok({ ...result2, placeName, approximate: true });
      }
    }

    return new Response(JSON.stringify({ error: "no_coords", resolvedUrl: finalUrl, placeName: placeName || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
