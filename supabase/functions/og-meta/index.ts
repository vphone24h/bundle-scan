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
  if (Array.isArray(payload)) return extractTenantId(payload[0]);
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
    const shortId = pathname.match(/-([a-f0-9]{8})(?:\/)?$/i)?.[1];
    if (/^\/san-pham(\/|$)/.test(pathname) && shortId) return { type: "product", id: shortId };
    if (/^\/tin-tuc(\/|$)/.test(pathname) && shortId) return { type: "article", id: shortId };
  } catch { /* ignore */ }
  return { type: "store", id: "store" };
};

const lookupTenantBySubdomain = async (
  supabase: ReturnType<typeof createClient>,
  subdomain: string,
): Promise<string | null> => {
  const normalized = subdomain.trim().toLowerCase();
  if (!normalized) return null;
  const { data } = await supabase.rpc("lookup_tenant_by_subdomain", { _subdomain: normalized });
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
    const isMainDomain = hostname === PRIMARY_DOMAIN || hostname === `www.${PRIMARY_DOMAIN}`;
    const isInternal = INTERNAL_HOSTS.has(hostname) || INTERNAL_HOST_SUFFIXES.some((s) => hostname.endsWith(s));

    if (!isMainDomain && !isInternal && !hostname.endsWith(`.${PRIMARY_DOMAIN}`)) {
      const { data } = await supabase.rpc("resolve_tenant_by_domain", { _domain: hostname });
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
      const tenantId = await lookupTenantBySubdomain(supabase, decodeURIComponent(pathParts[1]));
      if (tenantId) return tenantId;
    }
  } catch { /* ignore */ }
  return null;
};

const formatPrice = (price: number) => new Intl.NumberFormat("vi-VN").format(price);

/**
 * Auto-generate SEO-friendly title for a product
 * Format: "Product Name giá tốt | StoreName"
 */
const buildSeoTitle = (productName: string, store: string, price?: number | null): string => {
  const suffix = store ? ` | ${store}` : "";
  const priceTag = price ? ` giá ${formatPrice(price)}đ` : " giá tốt";
  const base = `${productName}${priceTag}${suffix}`;
  // Keep under 60 chars for Google
  if (base.length <= 60) return base;
  // Fallback: name + store only
  const short = `${productName}${suffix}`;
  return short.length <= 60 ? short : productName.substring(0, 57) + "...";
};

/**
 * Auto-generate meta description for product
 * Format: "Mua ProductName giá Xđ tại StoreName. Giao hàng nhanh, bảo hành chính hãng."
 */
const stripHtml = (html: string): string =>
  html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const buildSeoDescription = (
  productName: string,
  store: string,
  price?: number | null,
  originalDesc?: string | null,
  seoDesc?: string | null,
): string => {
  // 1. Highest priority: explicit SEO description set by the user
  if (seoDesc && seoDesc.trim().length > 0) {
    const clean = stripHtml(seoDesc).trim();
    if (clean.length > 0) {
      return clean.length <= 160 ? clean : clean.substring(0, 157) + "...";
    }
  }
  const cleanDesc = originalDesc ? stripHtml(originalDesc) : "";
  if (cleanDesc && cleanDesc.length > 30) {
    if (price && !cleanDesc.includes(formatPrice(price))) {
      const withPrice = `${formatPrice(price)}đ - ${cleanDesc}`;
      return withPrice.length <= 160 ? withPrice : withPrice.substring(0, 157) + "...";
    }
    return cleanDesc.length <= 160 ? cleanDesc : cleanDesc.substring(0, 157) + "...";
  }
  const parts = [`Mua ${productName}`];
  if (price) parts[0] += ` giá ${formatPrice(price)}đ`;
  if (store) parts.push(`tại ${store}`);
  parts.push("Giao hàng nhanh, bảo hành chính hãng.");
  const result = parts.join(". ");
  return result.length <= 160 ? result : result.substring(0, 157) + "...";
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
  let storeBannerUrl = "";
  let storePhone = "";
  let storeAddress = "";

  // Settings
  if (tenantId) {
    const { data: settings } = await supabase
      .from("tenant_landing_settings")
      .select("store_name, store_logo_url, banner_image_url, store_description, meta_description, meta_title, warranty_hotline, store_phone, store_address")
      .eq("tenant_id", tenantId)
      .eq("is_enabled", true)
      .maybeSingle();

    if (settings) {
      storeName = (settings as any).meta_title || settings.store_name || "";
      storeDescription = settings.store_description || (settings as any).meta_description || "";
      storeLogoUrl = settings.store_logo_url || "";
      storeBannerUrl = (settings as any).banner_image_url || "";
      storePhone = (settings as any).warranty_hotline || (settings as any).store_phone || "";
      storeAddress = (settings as any).store_address || "";
    }
  }

  // JSON-LD structured data
  const jsonLdScripts: string[] = [];
  let bodyContent = "";

  // Product detail
  if (type === "product" && tenantId && id && id !== "store") {
    let data: any = null;
    if (/^[a-f0-9]{8}$/i.test(id)) {
      const { data: rpcData } = await supabase.rpc("find_landing_product_by_short_id", {
        _tenant_id: tenantId,
        _short_id: id.toLowerCase(),
      });
      data = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    } else {
      const { data: row } = await supabase
        .from("landing_products")
        .select("id, name, description, seo_description, image_url, price, sale_price")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle();
      data = row;
    }

    if (data) {
      const price = data.sale_price || data.price;
      title = buildSeoTitle(data.name, storeName, price);
      description = buildSeoDescription(data.name, storeName, price, data.description, data.seo_description);
      imageUrl = data.image_url || storeLogoUrl || "";

      // Product JSON-LD
      jsonLdScripts.push(JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: data.name,
        ...(data.image_url ? { image: data.image_url } : {}),
        ...(data.description ? { description: data.description } : {}),
        offers: {
          "@type": "Offer",
          priceCurrency: "VND",
          price: price || 0,
          availability: "https://schema.org/InStock",
          ...(redirectUrl ? { url: redirectUrl } : {}),
        },
      }));

      // Breadcrumb
      if (redirectUrl) {
        const baseUrl = new URL(redirectUrl).origin;
        jsonLdScripts.push(JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: storeName || "Trang chủ", item: baseUrl },
            { "@type": "ListItem", position: 2, name: "Sản phẩm", item: `${baseUrl}/san-pham` },
            { "@type": "ListItem", position: 3, name: data.name, item: redirectUrl },
          ],
        }));
      }

      bodyContent = `<h1>${escHtml(data.name)}</h1>
        ${price ? `<p>Giá: ${formatPrice(price)}đ</p>` : ""}
        ${data.description ? `<p>${escHtml(data.description.substring(0, 500))}</p>` : ""}
        ${data.image_url ? `<img src="${escHtml(data.image_url)}" alt="${escHtml(data.name)}" />` : ""}`;
    }
  } else if (type === "article" && tenantId && id && id !== "store") {
    let data: any = null;
    if (/^[a-f0-9]{8}$/i.test(id)) {
      const { data: rpcData } = await supabase.rpc("find_landing_article_by_short_id", {
        _tenant_id: tenantId,
        _short_id: id.toLowerCase(),
      });
      data = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    } else {
      const { data: row } = await supabase
        .from("landing_articles")
        .select("id, title, summary, seo_description, thumbnail_url, content, created_at")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle();
      data = row;
    }

    if (data) {
      // SEO title for articles: "Title | StoreName" (under 60 chars)
      const artSuffix = storeName ? ` | ${storeName}` : "";
      const artTitle = `${data.title}${artSuffix}`;
      title = artTitle.length <= 60 ? artTitle : data.title.substring(0, 57) + "...";
      // Priority: seo_description > summary > fallback
      const rawDesc = (data.seo_description && data.seo_description.trim())
        || (data.summary && data.summary.trim())
        || (storeName ? `Đọc bài viết tại ${storeName}` : "");
      description = stripHtml(rawDesc);
      if (description.length > 160) description = description.substring(0, 157) + "...";
      imageUrl = data.thumbnail_url || storeLogoUrl || "";

      // Article JSON-LD
      jsonLdScripts.push(JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: data.title,
        ...(data.thumbnail_url ? { image: data.thumbnail_url } : {}),
        ...(data.summary ? { description: data.summary } : {}),
        ...(data.created_at ? { datePublished: data.created_at } : {}),
        ...(storeName ? {
          publisher: {
            "@type": "Organization",
            name: storeName,
            ...(storeLogoUrl ? { logo: { "@type": "ImageObject", url: storeLogoUrl } } : {}),
          },
        } : {}),
      }));

      bodyContent = `<article>
        <h1>${escHtml(data.title)}</h1>
        ${data.summary ? `<p>${escHtml(data.summary)}</p>` : ""}
        ${data.thumbnail_url ? `<img src="${escHtml(data.thumbnail_url)}" alt="${escHtml(data.title)}" />` : ""}
        ${(data as any).content ? `<div>${(data as any).content.substring(0, 2000)}</div>` : ""}
      </article>`;
    }
  }

  // Store-level: fetch top products for rich listing
  if (type === "store" && tenantId) {
    const { data: products } = await supabase
      .from("landing_products")
      .select("id, name, price, sale_price, image_url, description")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(20);

    if (products && products.length > 0) {
      bodyContent = `<h1>${escHtml(storeName || "Cửa hàng")}</h1>
        ${storeDescription ? `<p>${escHtml(storeDescription)}</p>` : ""}
        <h2>Sản phẩm</h2><ul>
        ${products.map((p: any) => {
          const price = p.sale_price || p.price;
          return `<li><a href="/san-pham/${p.id?.slice(0, 8) || ''}">${escHtml(p.name)}${price ? ` - ${formatPrice(price)}đ` : ""}</a></li>`;
        }).join("")}
        </ul>`;

      // ItemList JSON-LD for product listing
      if (redirectUrl) {
        const baseUrl = new URL(redirectUrl).origin;
        jsonLdScripts.push(JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: products.slice(0, 10).map((p: any, i: number) => ({
            "@type": "ListItem",
            position: i + 1,
            name: p.name,
            url: `${baseUrl}/san-pham/${p.id?.slice(0, 8) || ''}`,
          })),
        }));
      }
    }
  }

  // Fallback title/desc — store-level prefers banner image
  if (!title) {
    let hostFallback = "";
    if (redirectUrl) {
      try { hostFallback = new URL(redirectUrl).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    }
    title = storeName || hostFallback || "Cửa hàng";
    description =
      storeDescription ||
      (storeName
        ? `Truy cập ${storeName} để trải nghiệm ngay`
        : hostFallback
          ? `Truy cập ${hostFallback} để trải nghiệm ngay`
          : "Truy cập website để trải nghiệm ngay.");
    imageUrl = storeBannerUrl || storeLogoUrl || "";
  } else if (type === "store" && storeBannerUrl) {
    imageUrl = storeBannerUrl;
  }

  if (!title && redirectUrl) {
    try { title = new URL(redirectUrl).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
  }

  if (description.length > 200) {
    description = description.substring(0, 197) + "...";
  }

  // Organization JSON-LD (always)
  if (storeName) {
    jsonLdScripts.push(JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: storeName,
      ...(redirectUrl ? { url: new URL(redirectUrl).origin } : {}),
      ...(storeLogoUrl ? { logo: storeLogoUrl } : {}),
      ...(storeDescription ? { description: storeDescription } : {}),
      ...(storePhone ? { telephone: storePhone } : {}),
      ...(storeAddress ? { address: { "@type": "PostalAddress", streetAddress: storeAddress } } : {}),
    }));
  }

  const ogType = type === "product" ? "product" : type === "article" ? "article" : "website";
  const safeRedirect = redirectUrl || "/";
  const canonicalUrl = redirectUrl || "";

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(description)}">
<meta name="robots" content="index, follow">
${canonicalUrl ? `<link rel="canonical" href="${escHtml(canonicalUrl)}">` : ""}
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
${jsonLdScripts.map((s) => `<script type="application/ld+json">${s}</script>`).join("\n")}
<script>window.location.replace("${escJs(safeRedirect)}");</script>
</head>
<body>
${bodyContent || `<p>Đang chuyển hướng...</p>`}
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
});
