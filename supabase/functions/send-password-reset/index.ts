import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('cf-connecting-ip') 
    || req.headers.get('x-real-ip') 
    || '0.0.0.0'
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Rate limiting: 5 password resets per IP per 15 minutes
    const clientIP = getClientIP(req);
    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', {
      _function_name: 'send-password-reset',
      _ip_address: clientIP,
      _max_requests: 5,
      _window_minutes: 15,
    });

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase().slice(0, 320);
    const redirectUrl = String(body.redirectUrl || '').slice(0, 500);

    if (!email || !validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Email không hợp lệ" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const smtpUser = (Deno.env.get("SMTP_USER") || "").trim();
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    if (!smtpUser || !smtpPassword) {
      console.error("SMTP credentials not configured");
      return new Response(
        JSON.stringify({ error: "Cấu hình email chưa hoàn tất" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate password recovery link using Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError) {
      console.error("Generate link error:", linkError);
      // Don't reveal if email exists or not for security
      return new Response(
        JSON.stringify({ success: true, message: "Nếu email tồn tại, link khôi phục đã được gửi." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      console.error("No action link generated");
      return new Response(
        JSON.stringify({ success: true, message: "Nếu email tồn tại, link khôi phục đã được gửi." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Recovery link generated for:", email);

    // Send email via Gmail SMTP
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    const emailHtml = [
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">',
      '<div style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0;">',
      '<h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">VKHO</h1>',
      '<p style="color:#dbeafe;margin:8px 0 0 0;font-size:14px;">Hệ thống quản lý kho hàng</p>',
      '</div>',
      '<div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">',
      '<h2 style="color:#1f2937;font-size:20px;margin:0 0 16px 0;">Khôi phục mật khẩu</h2>',
      '<p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 8px 0;">Xin chào,</p>',
      '<p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px 0;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn nút bên dưới để tạo mật khẩu mới:</p>',
      '<div style="text-align:center;margin:32px 0;">',
      `<a href="${actionLink}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Đặt lại mật khẩu</a>`,
      '</div>',
      '<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:12px 16px;margin:24px 0;">',
      '<p style="color:#92400e;font-size:13px;margin:0;">⚠️ Link này sẽ hết hạn sau <strong>1 giờ</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>',
      '</div>',
      '<p style="color:#9ca3af;font-size:12px;margin:24px 0 0 0;padding-top:16px;border-top:1px solid #f3f4f6;">',
      'Nếu nút không hoạt động, sao chép và dán link sau vào trình duyệt:<br/>',
      `<a href="${actionLink}" style="color:#2563eb;word-break:break-all;font-size:11px;">${actionLink}</a></p>`,
      '</div>',
      '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:11px;">',
      `© ${new Date().getFullYear()} VKHO - Hệ thống quản lý kho hàng</div>`,
      '</div>',
    ].join('');

    await client.send({
      from: smtpUser,
      to: email,
      subject: "🔐 Khôi phục mật khẩu - VKHO",
      html: emailHtml,
    });

    await client.close();

    console.log("Password reset email sent to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Email khôi phục mật khẩu đã được gửi." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    return new Response(
      JSON.stringify({ error: "Không thể gửi email khôi phục" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
