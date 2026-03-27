import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PRIMARY_DOMAIN = "vkho.vn";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const escXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Simple Vietnamese slugify
const VIET_MAP: Record<string, string> = {
  'à':'a','á':'a','ả':'a','ã':'a','ạ':'a','ă':'a','ắ':'a','ằ':'a','ẳ':'a','ẵ':'a','ặ':'a',
  'â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a','đ':'d',
  'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e','ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
  'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
  'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o','ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o',
  'ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
  'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u','ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
  'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y',
};

function slugify(text: string): string {
  return text.toLowerCase().split('').map(c => VIET_MAP[c] || c).join('')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const extractTenantId = (payload: unknown): string | null => {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) return extractTenantId(payload[0]);
  if (typeof payload === "object") {
    const m = payload as Record<string, unknown>;
    if (typeof m.id === "string") return m.id;
    if (typeof m.tenant_id === "string") return m.tenant_id;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestUrl = new URL(req.url);
  const hostname = requestUrl.searchParams.get("domain") || req.headers.get("x-forwarded-host") || "";
  const subdomain = requestUrl.searchParams.get("subdomain") || "";

  if (!hostname && !subdomain) {
    return new Response("Missing domain or subdomain parameter", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let tenantId: string | null = null;
  let baseUrl = "";

  // Resolve tenant
  if (subdomain) {
    const { data } = await supabase.rpc("lookup_tenant_by_subdomain", { _subdomain: subdomain.trim().toLowerCase() });
    tenantId = extractTenantId(data);
    baseUrl = `https://${subdomain}.${PRIMARY_DOMAIN}`;
  } else if (hostname) {
    const h = hostname.toLowerCase();
    if (h.endsWith(`.${PRIMARY_DOMAIN}`)) {
      const sub = h.slice(0, -(`.${PRIMARY_DOMAIN}`).length);
      const { data } = await supabase.rpc("lookup_tenant_by_subdomain", { _subdomain: sub });
      tenantId = extractTenantId(data);
    } else {
      const { data } = await supabase.rpc("resolve_tenant_by_domain", { _domain: h });
      tenantId = extractTenantId(data);
    }
    baseUrl = `https://${h}`;
  }

  if (!tenantId) {
    return new Response("Tenant not found", { status: 404, headers: corsHeaders });
  }

  // Fetch products and articles in parallel
  const [productsRes, articlesRes] = await Promise.all([
    supabase
      .from("landing_products")
      .select("id, name, updated_at")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(500),
    supabase
      .from("landing_articles")
      .select("id, title, updated_at")
      .eq("tenant_id", tenantId)
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .limit(200),
  ]);

  const products = productsRes.data || [];
  const articles = articlesRes.data || [];

  const urls: string[] = [];

  // Homepage
  urls.push(`  <url>
    <loc>${escXml(baseUrl)}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);

  // Products listing page
  urls.push(`  <url>
    <loc>${escXml(baseUrl)}/san-pham</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);

  // Individual products
  for (const p of products) {
    const shortId = p.id?.slice(0, 8) || "";
    const slug = slugify(p.name || "");
    const lastmod = p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : "";
    urls.push(`  <url>
    <loc>${escXml(baseUrl)}/san-pham/${escXml(slug)}-${shortId}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  // Articles listing page
  if (articles.length > 0) {
    urls.push(`  <url>
    <loc>${escXml(baseUrl)}/tin-tuc</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);

    for (const a of articles) {
      const shortId = a.id?.slice(0, 8) || "";
      const slug = slugify(a.title || "");
      const lastmod = a.updated_at ? new Date(a.updated_at).toISOString().split("T")[0] : "";
      urls.push(`  <url>
    <loc>${escXml(baseUrl)}/tin-tuc/${escXml(slug)}-${shortId}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
    }
  }

  // Static pages
  const staticPages = [
    { path: "/bao-hanh", priority: "0.5" },
    { path: "/lien-he", priority: "0.5" },
  ];
  for (const page of staticPages) {
    urls.push(`  <url>
    <loc>${escXml(baseUrl)}${page.path}</loc>
    <changefreq>monthly</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
});
