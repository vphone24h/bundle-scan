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
  // Find all q= values in the URL (including inside continue= params)
  // Decode the entire URL multiple times to handle double/triple encoding
  let decoded = url;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { break; }
  }
  decoded = decoded.replace(/\+/g, " ");

  // Now find all q= values
  const qMatches = [...decoded.matchAll(/[?&]q=([^&]+)/g)];
  for (const m of qMatches) {
    const val = m[1].trim();
    // Skip captcha tokens (long alphanumeric strings starting with Eh)
    if (val.startsWith("Eh") && val.length > 50) continue;
    if (/^[A-Za-z0-9_-]{40,}$/.test(val)) continue;
    // Skip pure numbers
    if (/^\d+$/.test(val)) continue;
    if (val.length > 3 && val.length < 300) return val;
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
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Step 1: Follow redirects
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" } });
    const finalUrl = res.url;

    // Step 2: Try extracting coords from URL
    const fromUrl = extractCoords(finalUrl);
    if (fromUrl) return ok(fromUrl);

    // Step 3: Extract place name from URL (handles captcha/sorry pages with double-encoding)
    const placeName = extractPlaceNameFromUrl(finalUrl);

    if (placeName) {
      // Strategy 1: Extract "Quận X" and location from the name
      const quanMatch = placeName.match(/Quận\s*\d+/i);
      const locationAfterDash = placeName.split(/\s*[-–]\s*/).pop()?.trim();
      
      if (quanMatch && locationAfterDash) {
        const query = `${quanMatch[0]}, ${locationAfterDash.replace(/^TP\s+/i, "")}, Hồ Chí Minh`;
        const result = await geocodeNominatim(query);
        if (result) return ok({ ...result, placeName, approximate: true });
      }

      if (quanMatch) {
        const result = await geocodeNominatim(`${quanMatch[0]}, Hồ Chí Minh`);
        if (result) return ok({ ...result, placeName, approximate: true });
      }

      // Strategy 2: Full name
      const result = await geocodeNominatim(placeName);
      if (result) return ok({ ...result, placeName, approximate: true });

      // Strategy 3: After dash only
      if (locationAfterDash && locationAfterDash !== placeName) {
        const result2 = await geocodeNominatim(locationAfterDash + ", Hồ Chí Minh");
        if (result2) return ok({ ...result2, placeName, approximate: true });
      }
    }

    return new Response(JSON.stringify({ error: "no_coords", resolvedUrl: finalUrl, placeName: placeName || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
