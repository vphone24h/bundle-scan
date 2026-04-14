import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Follow redirects to get the final URL
    let finalUrl = url;
    try {
      const res = await fetch(url, { redirect: "follow" });
      finalUrl = res.url;
      // Also check body for meta refresh or JS redirect
      if (!finalUrl || finalUrl === url) {
        const body = await res.text();
        const metaMatch = body.match(/content="0;\s*url=([^"]+)"/i) || body.match(/window\.location\s*=\s*['"]([^'"]+)['"]/);
        if (metaMatch) finalUrl = metaMatch[1];
      }
    } catch {
      // If fetch fails, try with different user agent
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; bot)" },
      });
      finalUrl = res.url;
    }

    // Extract coordinates from the final URL
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /center=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/,
    ];

    for (const pattern of patterns) {
      const match = finalUrl.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return new Response(JSON.stringify({ lat, lng, resolvedUrl: finalUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: "no_coords", resolvedUrl: finalUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
