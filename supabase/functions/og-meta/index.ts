import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PRIMARY_DOMAIN = "vkho.vn";
const INTERNAL_HOSTS = new Set(["localhost", "bundle-scan.lovable.app"]);
const INTERNAL_HOST_SUFFIXES = [".lovable.app", ".lovableproject.com"];

type MetaType = "product" | "article" | "store";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const escHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escJs = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const sanitizeAbsoluteUrl = (raw: string | null): string => {
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
};

const extractTenantId = (payload: unknown): string | null => {
  if (!payload) return null;
  if (typeof payload === "string") return payload;

  if (Array.isArray(payload)) {
    return extractTenantId(payload[0]);
  }

  if (typeof payload === "object") {
    const maybe = payload as Record<string, unknown>;
    if (typeof maybe.id === "string") return maybe.id;
    if (typeof maybe.tenant_id === "string") return maybe.tenant_id;
  }

  return null;
};

const inferMetaTargetFromUrl = (redirectUrl: string): { type: MetaType; id: string } => {
  if (!redirectUrl) return { type: "store", id: "store" };

  try {
    const pathname = new URL(redirectUrl).pathname;
    const shortId = pathname.match(/-([a-f0-9]{8})$/i)?.[1];

    if (pathname.startsWith("/san-pham/") && shortId) {
      return { type: "product", id: shortId };
    }

    if (pathname.startsWith("/tin-tuc/") && shortId) {
      return { type: "article", id: shortId };
    }
  } catch {
    // ignore
  }

  return { type: "store", id: "store" };
};

const lookupTenantBySubdomain = async (
  supabase: ReturnType<typeof createClient>,
  subdomain: string,
): Promise<string | null> => {
  const normalized = subdomain.trim().toLowerCase();
  if (!normalized) return null;

  const { data } = await supabase.rpc("lookup_tenant_by_subdomain", {
    _subdomain: normalized,
  });

  return extractTenantId(data);
};

const resolveTenantIdFromRedirectUrl = async (
  supabase: ReturnType<typeof createClient>,
  redirectUrl: string,
): Promise<string | null> => {
  if (!redirectUrl) return null;

  try {
    const parsed = new URL(redirectUrl);
    const hostname = parsed.hostname.toLowerCase();

    const isMainDomain =
      hostname === PRIMARY_DOMAIN || hostname === `www.${PRIMARY_DOMAIN}`;
    const isInternal =
      INTERNAL_HOSTS.has(hostname) ||
      INTERNAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));

    if (!isMainDomain && !isInternal && !hostname.endsWith(`.${PRIMARY_DOMAIN}`)) {
      const { data } = await supabase.rpc("resolve_tenant_by_domain", {
        _domain: hostname,
      });
      const tenantId = extractTenantId(data);
      if (tenantId) return tenantId;
    }

    if (hostname.endsWith(`.${PRIMARY_DOMAIN}`)) {
      const subdomain = hostname.slice(0, -(`.${PRIMARY_DOMAIN}`).length);
      if (subdomain && subdomain !== "www") {
        const tenantId = await lookupTenantBySubdomain(supabase, subdomain);
        if (tenantId) return tenantId;
      }
    }

    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts[0] === "store" && pathParts[1]) {
      const tenantId = await lookupTenantBySubdomain(
        supabase,
        decodeURIComponent(pathParts[1]),
      );
      if (tenantId) return tenantId;
    }
  } catch {
    // ignore
  }

  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestUrl = new URL(req.url);
  const requestedType = requestUrl.searchParams.get("type");
  const requestedId = requestUrl.searchParams.get("id");
  const requestedTenantId = requestUrl.searchParams.get("tenant_id");

  const redirectUrl =
    sanitizeAbsoluteUrl(requestUrl.searchParams.get("url")) ||
    sanitizeAbsoluteUrl(req.headers.get("referer"));

  const supabase = createClient(supabaseUrl, supabaseKey);

  let tenantId = requestedTenantId;
  if (!tenantId && redirectUrl) {
    tenantId = await resolveTenantIdFromRedirectUrl(supabase, redirectUrl);
  }

  const inferredTarget = inferMetaTargetFromUrl(redirectUrl);
  const type: MetaType =
    requestedType === "product" || requestedType === "article" || requestedType === "store"
      ? requestedType
      : inferredTarget.type;
  const id = requestedId || inferredTarget.id;

  let title = "";
  let description = "";
  let imageUrl = "";
  let storeName = "";
  let storeDescription = "";
  let storeLogoUrl = "";

  if (tenantId) {
    const { data: settings } = await supabase
      .from("tenant_landing_settings")
      .select("store_name, store_logo_url, store_description, meta_description")
      .eq("tenant_id", tenantId)
      .eq("is_enabled", true)
      .maybeSingle();

    if (settings) {
      storeName = settings.store_name || "";
      storeDescription = settings.store_description || settings.meta_description || "";
      storeLogoUrl = settings.store_logo_url || "";
    }
  }

  if (type === "product" && tenantId && id && id !== "store") {
    let query = supabase
      .from("landing_products")
      .select("id, name, description, image_url, price, sale_price")
      .eq("tenant_id", tenantId);

    if (/^[a-f0-9]{8}$/i.test(id)) {
      query = query.ilike("id", `${id}%`);
    } else {
      query = query.eq("id", id);
    }

    const { data } = await query.limit(1).maybeSingle();

    if (data) {
      title = `${data.name}${storeName ? ` - ${storeName}` : ""}`;
      description = data.description || (storeName ? `Sản phẩm tại ${storeName}` : "");
      imageUrl = data.image_url || storeLogoUrl || "";
      const price = data.sale_price || data.price;
      if (price) {
        description = `${new Intl.NumberFormat("vi-VN").format(price)}đ - ${description}`;
      }
    }
  } else if (type === "article" && tenantId && id && id !== "store") {
    let query = supabase
      .from("landing_articles")
      .select("id, title, summary, thumbnail_url")
      .eq("tenant_id", tenantId);

    if (/^[a-f0-9]{8}$/i.test(id)) {
      query = query.ilike("id", `${id}%`);
    } else {
      query = query.eq("id", id);
    }

    const { data } = await query.limit(1).maybeSingle();

    if (data) {
      title = `${data.title}${storeName ? ` - ${storeName}` : ""}`;
      description = data.summary || (storeName ? `Bài viết tại ${storeName}` : "");
      imageUrl = data.thumbnail_url || storeLogoUrl || "";
    }
  }

  if (!title) {
    title = storeName || "Cùng trãi nghiệm";
    description =
      storeDescription ||
      (storeName
        ? `Chào mừng đến với ${storeName}`
        : "Truy cập website để trải nghiệm ngay.");
    imageUrl = storeLogoUrl || "";
  }

  if (!title && redirectUrl) {
    try {
      title = new URL(redirectUrl).hostname.replace(/^www\./, "");
    } catch {
      // ignore
    }
  }

  if (description.length > 200) {
    description = description.substring(0, 197) + "...";
  }

  const ogType = type === "product" ? "product" : type === "article" ? "article" : "website";
  const safeRedirect = redirectUrl || "/";

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(description)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
${imageUrl ? `<meta property="og:image" content="${escHtml(imageUrl)}">` : ""}
<meta property="og:url" content="${escHtml(safeRedirect)}">
<meta property="og:site_name" content="${escHtml(storeName || title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(description)}">
${imageUrl ? `<meta name="twitter:image" content="${escHtml(imageUrl)}">` : ""}
<script>window.location.replace("${escJs(safeRedirect)}");</script>
</head>
<body>
<p>Đang chuyển hướng...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
});
