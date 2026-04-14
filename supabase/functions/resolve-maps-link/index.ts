import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractCoords(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /center=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Step 1: Follow redirects
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
    const finalUrl = res.url;
    const body = await res.text();

    // Step 2: Try extracting coords from the final URL
    const fromUrl = extractCoords(finalUrl);
    if (fromUrl) {
      return new Response(JSON.stringify(fromUrl), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 3: Try extracting coords from HTML body
    const bodyCoords = extractCoords(body);
    if (bodyCoords) {
      return new Response(JSON.stringify(bodyCoords), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 4: Extract place name from URL or body, then geocode via Nominatim
    let placeName = "";

    // From URL query param "q="
    const qMatch = finalUrl.match(/[?&]q=([^&]+)/);
    if (qMatch) placeName = decodeURIComponent(qMatch[1]).replace(/\+/g, " ");

    // From page title
    if (!placeName) {
      const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        placeName = titleMatch[1]
          .replace(/ - Google (Search|Maps|Tìm kiếm).*/i, "")
          .replace(/ - Google$/i, "")
          .trim();
      }
    }

    if (placeName) {
      // Geocode the place name
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1&countrycodes=vn`,
        { headers: { "User-Agent": "VKHO-App/1.0" } }
      );
      const geoData = await geoRes.json();
      if (geoData?.length > 0) {
        const lat = parseFloat(geoData[0].lat);
        const lng = parseFloat(geoData[0].lon);
        return new Response(JSON.stringify({ lat, lng, placeName, address: geoData[0].display_name }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try simpler search - remove brand/store prefixes
      const simpler = placeName.replace(/^.*?[-–]\s*/, "").trim();
      if (simpler && simpler !== placeName) {
        const geoRes2 = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simpler)}&limit=1&countrycodes=vn`,
          { headers: { "User-Agent": "VKHO-App/1.0" } }
        );
        const geoData2 = await geoRes2.json();
        if (geoData2?.length > 0) {
          const lat = parseFloat(geoData2[0].lat);
          const lng = parseFloat(geoData2[0].lon);
          return new Response(JSON.stringify({ lat, lng, placeName: simpler, address: geoData2[0].display_name }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: "no_coords", resolvedUrl: finalUrl, placeName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
