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

function safeDecode(s: string): string {
  try {
    let result = decodeURIComponent(s);
    // Double-decode if still has encoded chars
    if (result.includes('%')) result = decodeURIComponent(result);
    return result.replace(/\+/g, " ");
  } catch {
    return s.replace(/\+/g, " ");
  }
}

function extractPlaceName(url: string): string {
  // Try direct q= param first
  let qMatch = url.match(/[?&]q=([^&]+)/);
  if (qMatch) {
    const val = safeDecode(qMatch[1]);
    if (val.length < 200 && !val.startsWith("Eh") && !/^[A-Za-z0-9_-]{40,}$/.test(val)) return val;
  }
  
  // Try q= inside continue= param (Google sorry/captcha page)
  const continueMatch = url.match(/continue=([^&]+)/);
  if (continueMatch) {
    const continueUrl = safeDecode(continueMatch[1]);
    qMatch = continueUrl.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      const val = safeDecode(qMatch[1]);
      if (val.length < 200 && !val.startsWith("Eh") && !/^[A-Za-z0-9_-]{40,}$/.test(val)) return val;
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

    // Step 3: Extract place name (handles captcha/sorry pages too)
    const placeName = extractPlaceName(finalUrl);

    if (placeName) {
      // Strategy 1: Extract location keywords (Quận X, district names)
      const locationParts = placeName.match(/(?:Quận\s*\d+|Huyện\s+\S+|TP\s+\S+[\s\S]*?(?=\s*$|\s*[-,]))/gi);
      
      if (locationParts) {
        // Try "Quận 9, Thủ Đức, Hồ Chí Minh" style
        const locationQuery = locationParts.join(", ").replace(/TP\s+/gi, "") + ", Hồ Chí Minh";
        const result = await geocodeNominatim(locationQuery);
        if (result) return ok({ ...result, placeName, approximate: true });
      }

      // Strategy 2: Take part after dash (e.g. "TP Thủ Đức")
      const afterDash = placeName.split(/\s*[-–]\s*/).pop()?.trim();
      if (afterDash && afterDash !== placeName) {
        // Add "Quận" context if present in full name
        const quanMatch = placeName.match(/Quận\s*\d+/i);
        const searchQuery = quanMatch ? `${quanMatch[0]}, ${afterDash}, Hồ Chí Minh` : `${afterDash}, Hồ Chí Minh`;
        const result = await geocodeNominatim(searchQuery);
        if (result) return ok({ ...result, placeName, approximate: true });
      }

      // Strategy 3: Full name
      const result = await geocodeNominatim(placeName);
      if (result) return ok({ ...result, placeName, approximate: true });
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
