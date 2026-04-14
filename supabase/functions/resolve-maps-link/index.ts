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
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } });
    const finalUrl = res.url;

    // Step 2: Try extracting coords from URL
    const fromUrl = extractCoords(finalUrl);
    if (fromUrl) return ok(fromUrl);

    // Step 3: Extract place name and kgmid from URL
    let placeName = "";
    const qMatch = finalUrl.match(/[?&]q=([^&]+)/);
    if (qMatch) placeName = decodeURIComponent(qMatch[1]).replace(/\+/g, " ");

    const kgmidMatch = finalUrl.match(/kgmid=([^&]+)/);
    const kgmid = kgmidMatch ? decodeURIComponent(kgmidMatch[1]) : null;

    // Step 4: Try Google Maps with kgmid or place name to get coordinates
    if (kgmid || placeName) {
      const searchQuery = placeName || kgmid;
      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery!)}`;
      try {
        const mapsRes = await fetch(mapsUrl, {
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        });
        const mapsUrl2 = mapsRes.url;
        const fromMaps = extractCoords(mapsUrl2);
        if (fromMaps) return ok({ ...fromMaps, placeName });

        const mapsBody = await mapsRes.text();
        // Search for coord patterns in Maps page JS data
        // Pattern: ,[LAT],[LNG], where lat is ~8-24 (Vietnam) and lng is ~100-115
        const coordRegex = /,(-?\d{1,2}\.\d{6,}),(\d{2,3}\.\d{6,})[,\]]/g;
        let bestMatch = null;
        for (const m of mapsBody.matchAll(coordRegex)) {
          const lat = parseFloat(m[1]);
          const lng = parseFloat(m[2]);
          if (lat >= 8 && lat <= 24 && lng >= 100 && lng <= 115) {
            bestMatch = { lat, lng };
            break;
          }
        }
        if (bestMatch) return ok({ ...bestMatch, placeName });
      } catch (_) {}
    }

    // Step 5: Smart Nominatim geocoding with multiple strategies
    if (placeName) {
      // Strategy 1: Full name
      let result = await geocodeNominatim(placeName);
      if (result) return ok({ ...result, placeName, approximate: true });

      // Strategy 2: Remove brand prefix, keep location part
      // "Hệ Thống Cửa Hàng Di Động VPhone24h Quận 9 - TP Thủ Đức" -> "Quận 9 TP Thủ Đức"
      const afterDash = placeName.split(/[-–]/).pop()?.trim();
      const locationParts = placeName.match(/(?:Quận|Huyện|Phường|Xã|TP|Thành phố|Thủ Đức|Bình Thạnh|Gò Vấp|Tân Bình|Tân Phú|Phú Nhuận|Bình Tân|Quận \d+)[^,]*/gi);
      
      if (locationParts && locationParts.length > 0) {
        const locationQuery = locationParts.join(", ") + ", Hồ Chí Minh";
        result = await geocodeNominatim(locationQuery);
        if (result) return ok({ ...result, placeName, approximate: true });
      }

      if (afterDash && afterDash !== placeName) {
        result = await geocodeNominatim(afterDash + ", Hồ Chí Minh");
        if (result) return ok({ ...result, placeName, approximate: true });
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
