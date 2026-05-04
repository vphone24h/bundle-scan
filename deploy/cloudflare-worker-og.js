/**
 * Cloudflare Worker: Bot/Crawler OG Meta Proxy
 * ============================================
 *
 * Mục đích: Khi Zalo/Facebook/Twitter/Telegram... crawl link cửa hàng
 * (ví dụ https://baohanh.vphone.vn/...), Worker sẽ phát hiện và proxy
 * sang `og-meta` edge function để trả về meta tag (title, description,
 * og:image, banner) ĐÚNG của shop đó — thay vì meta mặc định "vkho.vn".
 *
 * Người dùng thật (browser) vẫn được phục vụ bình thường (passthrough).
 *
 * ============================================
 * CÁCH DEPLOY (1 lần, áp dụng cho tất cả domain):
 * ============================================
 * 1. Vào Cloudflare Dashboard → Workers & Pages → Create Worker
 * 2. Đặt tên: "og-meta-bot-proxy" → Deploy
 * 3. Edit Code → Paste toàn bộ nội dung file này → Save & Deploy
 * 4. Vào tab "Triggers" → Add Custom Domain hoặc Routes:
 *    Cho MỖI domain shop, thêm route:
 *      *baohanh.vphone.vn/*
 *      *vphone.vn/*
 *      *vkho.vn/*
 *      *nguyenkieuanh.net/*
 *      *thkho.com/*
 *      *iphonebaonoxau.com/*
 *      *tuanapple.com/*
 *      *hbmusic.io.vn/*
 *    (Mỗi shop mới thêm domain → thêm route ở đây)
 *
 * Sau khi deploy, dùng Facebook Debugger (developers.facebook.com/tools/debug/)
 * "Scrape Again" để FB/Zalo refresh cache cho link đã share trước đó.
 */

const OG_META_ENDPOINT = "https://rodpbhesrwykmpywiiyd.supabase.co/functions/v1/og-meta";

// Regex phát hiện crawler/bot của các nền tảng share link
const BOT_UA_REGEX = /(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|Pinterest|SkypeUriPreview|zalo|Zalo|vkShare|redditbot|Applebot|Googlebot|bingbot|YandexBot|DuckDuckBot|Baiduspider|Embedly|Iframely|SemrushBot|AhrefsBot|outbrain|quora link preview|nuzzel|bitlybot|tumblr|GoogleOther|Mastodon|line-poker|Line|Viber|Snapchat|MetaInspector|InstagramBot)/i;

/**
 * IMPORTANT: Cloudflare Worker editor "Quick Edit" uses Service Worker syntax
 * (addEventListener), NOT ES Module syntax (export default).
 * Nếu paste `export default { fetch }` vào editor cũ → lỗi "deploy is not defined".
 * Đoạn code dưới dùng addEventListener — paste trực tiếp vào worker.js là chạy được.
 */
async function handleRequest(request) {
  const ua = request.headers.get("user-agent") || "";
  const url = new URL(request.url);
  const accept = request.headers.get("accept") || "";

  const isBot = BOT_UA_REGEX.test(ua);
  const isHtmlNav = request.method === "GET" && (
    accept.includes("text/html") || accept.includes("*/*") || !accept
  );

  if (!isBot || !isHtmlNav) {
    return fetch(request);
  }

  const metaUrl = new URL(OG_META_ENDPOINT);
  metaUrl.searchParams.set("url", url.toString());

  try {
    const metaResp = await fetch(metaUrl.toString(), {
      headers: { "user-agent": ua },
    });
    const html = await metaResp.text();
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=3600",
        "x-og-proxy": "1",
      },
    });
  } catch (err) {
    return fetch(request);
  }
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});