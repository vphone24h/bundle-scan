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

function fullyDecode(s: string): string {
  let result = s;
  for (let i = 0; i < 5; i++) {
    try {
      const next = decodeURIComponent(result);
      if (next === result) break;
      result = next;
    } catch { break; }
  }
  return result.replace(/\+/g, " ");
}

function extractPlaceNameFromUrl(url: string): string {
  // Find q= values at various encoding levels
  // Pattern matches: q= or q%3D followed by value until & or %26 or end
  const rawPatterns = [
    /[?&]q=([^&]+)/g,
    /q%3D([^&%]*(?:%(?!26|3[dD])[^&]*)*)/g, // q%3D...until %26 or &
  ];

  // Also try to find it in the raw URL with manual extraction
  // Look for q%3D in continue= value
  const continueMatch = url.match(/continue=([^&\s]+)/);
  const urlsToSearch = [url];
  if (continueMatch) {
    urlsToSearch.push(fullyDecode(continueMatch[1]));
  }

  for (const searchUrl of urlsToSearch) {
    for (const pattern of rawPatterns) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(searchUrl)) !== null) {
        const val = fullyDecode(m[1]).trim();
        // Skip captcha tokens
        if (val.length > 200) continue;
        if (/^[A-Za-z0-9_\-]{40,}$/.test(val)) continue;
        if (val.startsWith("Eh") && /^[A-Za-z0-9_\-+/=]{20,}$/.test(val)) continue;
        if (val.length > 3) return val;
      }
    }
  }
  return "";
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
      const locationAfterDash = placeName.split(/\s*[-–]\s*/).pop()?.trim();

      if (quanMatch) {
        const city = locationAfterDash?.replace(/^TP\s+/i, "") || "Hồ Chí Minh";
        const result = await geocodeNominatim(`${quanMatch[0]}, ${city}, Hồ Chí Minh`);
        if (result) return ok({ ...result, placeName, approximate: true });

        const result2 = await geocodeNominatim(`${quanMatch[0]}, Hồ Chí Minh`);
        if (result2) return ok({ ...result2, placeName, approximate: true });
      }

      // Strategy 2: Full name
      const result = await geocodeNominatim(placeName);
      if (result) return ok({ ...result, placeName, approximate: true });

      // Strategy 3: After dash only  
      if (locationAfterDash && locationAfterDash !== placeName) {
        const result2 = await geocodeNominatim(locationAfterDash);
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
