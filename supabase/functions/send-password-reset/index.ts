import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ResetRequest {
  email: string;
  redirectUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectUrl }: ResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email là bắt buộc" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    if (!smtpUser || !smtpPassword) {
      console.error("SMTP credentials not configured");
      return new Response(
        JSON.stringify({ error: "Cấu hình email chưa hoàn tất" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate password recovery link using Admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
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

    // Build the recovery URL with the token
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

    await client.send({
      from: smtpUser,
      to: email,
      subject: "🔐 Khôi phục mật khẩu - VKHO",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">VKHO</h1>
            <p style="color: #dbeafe; margin: 8px 0 0 0; font-size: 14px;">Hệ thống quản lý kho hàng</p>
          </div>
          
          <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 16px 0;">Khôi phục mật khẩu</h2>
            
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
              Xin chào,
            </p>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn nút bên dưới để tạo mật khẩu mới:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${actionLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.3px;">
                Đặt lại mật khẩu
              </a>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 12px 16px; margin: 24px 0;">
              <p style="color: #92400e; font-size: 13px; margin: 0;">
                ⚠️ Link này sẽ hết hạn sau <strong>1 giờ</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
              </p>
            </div>
            
            <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #f3f4f6;">
              Nếu nút không hoạt động, sao chép và dán link sau vào trình duyệt:<br/>
              <a href="${actionLink}" style="color: #2563eb; word-break: break-all; font-size: 11px;">${actionLink}</a>
            </p>
          </div>
          
          <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
            © ${new Date().getFullYear()} VKHO - Hệ thống quản lý kho hàng
          </div>
        </div>
      `,
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
      JSON.stringify({ error: error.message || "Không thể gửi email khôi phục" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
