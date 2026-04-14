import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractCoords(text: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /center=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /\[(-?\d{1,3}\.\d{5,}),\s*(-?\d{1,3}\.\d{5,})\]/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
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
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
    const finalUrl = res.url;
    const body = await res.text();

    // Step 2: Try extracting coords from the final URL
    const fromUrl = extractCoords(finalUrl);
    if (fromUrl) {
      return ok(fromUrl);
    }

    // Step 3: Try extracting coords from HTML body  
    const fromBody = extractCoords(body);
    if (fromBody) {
      return ok(fromBody);
    }

    // Step 4: Extract place name from URL "q=" param
    let placeName = "";
    const qMatch = finalUrl.match(/[?&]q=([^&]+)/);
    if (qMatch) placeName = decodeURIComponent(qMatch[1]).replace(/\+/g, " ");

    if (!placeName) {
      const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        placeName = titleMatch[1].replace(/ - Google.*/i, "").trim();
      }
    }

    if (placeName) {
      // Step 5: Try Google Maps search page to find coordinates
      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(placeName)}`;
      try {
        const mapsRes = await fetch(mapsUrl, {
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        });
        const mapsBody = await mapsRes.text();
        const mapsUrlFinal = mapsRes.url;

        // Check final URL for coords
        const fromMapsUrl = extractCoords(mapsUrlFinal);
        if (fromMapsUrl) return ok({ ...fromMapsUrl, placeName });

        // Search body for coordinate patterns like [null,null,LAT,LNG] or APP_INITIALIZATION_STATE with coords
        const coordPatterns = [
          /\[null,null,(-?\d{1,3}\.\d{5,}),(-?\d{1,3}\.\d{5,})\]/,
          /center[^\[]*\[(-?\d{1,3}\.\d{5,}),\s*(-?\d{1,3}\.\d{5,})\]/,
          /latlng[^\{]*\{[^\}]*lat[^\d]*(-?\d{1,3}\.\d{5,})[^\d]*lng[^\d]*(-?\d{1,3}\.\d{5,})/i,
          /\\"(-?\d{1,2}\.\d{5,})\\",\s*\\"(-?\d{2,3}\.\d{5,})\\"/,
        ];
        for (const p of coordPatterns) {
          const m = mapsBody.match(p);
          if (m) {
            const lat = parseFloat(m[1]);
            const lng = parseFloat(m[2]);
            if (lat >= 5 && lat <= 25 && lng >= 100 && lng <= 115) {
              return ok({ lat, lng, placeName });
            }
          }
        }

        // Try to find any coordinate pair in Vietnam range
        const allCoords = [...mapsBody.matchAll(/(-?\d{1,2}\.\d{6,})\D{1,5}(\d{2,3}\.\d{6,})/g)];
        for (const m of allCoords) {
          const lat = parseFloat(m[1]);
          const lng = parseFloat(m[2]);
          if (lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110) {
            return ok({ lat, lng, placeName });
          }
        }
      } catch (_) {
        // Google Maps search failed, fall through to Nominatim
      }

      // Step 6: Fallback to Nominatim geocoding
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1&countrycodes=vn`,
        { headers: { "User-Agent": "VKHO-App/1.0" } }
      );
      const geoData = await geoRes.json();
      if (geoData?.length > 0) {
        return ok({
          lat: parseFloat(geoData[0].lat),
          lng: parseFloat(geoData[0].lon),
          placeName,
          address: geoData[0].display_name,
          approximate: true,
        });
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

function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
