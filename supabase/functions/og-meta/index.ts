import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // 'product' or 'article'
  const id = url.searchParams.get("id");
  const tenantId = url.searchParams.get("tenant_id");
  const redirectUrl = url.searchParams.get("url") || "";

  if (!type || !id || !tenantId) {
    return new Response("Missing params", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let title = "";
  let description = "";
  let imageUrl = "";
  let storeName = "";

  // Get store info
  try {
    const { data: settings } = await supabase
      .from("landing_page_settings")
      .select("store_name, store_logo_url, store_description")
      .eq("tenant_id", tenantId)
      .single();
    if (settings) {
      storeName = settings.store_name || "";
    }
  } catch {}

  if (type === "product") {
    const { data } = await supabase
      .from("landing_products")
      .select("name, description, image_url, price, sale_price")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();
    if (data) {
      title = `${data.name}${storeName ? ` - ${storeName}` : ""}`;
      description = data.description || `Sản phẩm tại ${storeName}`;
      imageUrl = data.image_url || "";
      const price = data.sale_price || data.price;
      if (price) {
        description = `${new Intl.NumberFormat("vi-VN").format(price)}đ - ${description}`;
      }
    }
  } else if (type === "article") {
    const { data } = await supabase
      .from("landing_articles")
      .select("title, summary, thumbnail_url")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();
    if (data) {
      title = `${data.title}${storeName ? ` - ${storeName}` : ""}`;
      description = data.summary || `Bài viết tại ${storeName}`;
      imageUrl = data.thumbnail_url || "";
    }
  }

  if (!title) {
    // Fallback: redirect directly
    return Response.redirect(redirectUrl || "https://vkho.vn", 302);
  }

  // Truncate description
  if (description.length > 200) {
    description = description.substring(0, 197) + "...";
  }

  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(description)}">
<meta property="og:type" content="${type === "product" ? "product" : "article"}">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
${imageUrl ? `<meta property="og:image" content="${escHtml(imageUrl)}">` : ""}
<meta property="og:url" content="${escHtml(redirectUrl)}">
<meta property="og:site_name" content="${escHtml(storeName || "vkho.vn")}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(description)}">
${imageUrl ? `<meta name="twitter:image" content="${escHtml(imageUrl)}">` : ""}
<script>window.location.replace("${redirectUrl.replace(/"/g, '\\"')}");</script>
</head>
<body>
<p>Đang chuyển hướng...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
