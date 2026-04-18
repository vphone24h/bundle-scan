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
    || '0.0.0.0';
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  source: 'company' | 'global';
  companyName?: string;
}

async function findCompanyByDomain(supabaseAdmin: any, hostname: string): Promise<string | null> {
  if (!hostname) return null;
  const host = hostname.toLowerCase().replace(/^www\./, '');
  try {
    const { data: cd } = await supabaseAdmin
      .from('custom_domains')
      .select('tenant_id')
      .eq('domain', host)
      .maybeSingle();
    if (cd?.tenant_id) {
      const { data: t } = await supabaseAdmin.from('tenants').select('company_id').eq('id', cd.tenant_id).maybeSingle();
      if (t?.company_id) return t.company_id;
    }
    const { data: c } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('domain', host)
      .maybeSingle();
    if (c?.id) return c.id;
  } catch (e) {
    console.error('findCompanyByDomain error:', e);
  }
  return null;
}

async function getCompanySmtp(supabaseAdmin: any, companyId: string): Promise<SmtpConfig | null> {
  const { data: cfg } = await supabaseAdmin
    .from('company_email_config')
    .select('smtp_host, smtp_port, smtp_user, smtp_pass, from_email, from_name, is_enabled')
    .eq('company_id', companyId)
    .maybeSingle();
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle();
  if (cfg?.is_enabled && cfg.smtp_host && cfg.smtp_user && cfg.smtp_pass) {
    return {
      host: cfg.smtp_host,
      port: cfg.smtp_port || 465,
      user: cfg.smtp_user,
      password: cfg.smtp_pass,
      fromEmail: cfg.from_email || cfg.smtp_user,
      fromName: cfg.from_name || company?.name || 'VKHO',
      source: 'company',
      companyName: company?.name,
    };
  }
  return null;
}

async function resolveSmtpConfig(
  supabaseAdmin: any,
  email: string,
  hostname?: string
): Promise<SmtpConfig | null> {
  // Priority 1: SMTP of the company owning the current domain
  if (hostname) {
    const companyId = await findCompanyByDomain(supabaseAdmin, hostname);
    if (companyId) {
      const smtp = await getCompanySmtp(supabaseAdmin, companyId);
      if (smtp) {
        console.log(`Resolved SMTP via domain ${hostname} → company ${companyId}`);
        return smtp;
      }
    }
  }

  // Priority 2: SMTP of the company that owns the user's tenant
  try {
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = usersList?.users?.find((u: any) => u.email?.toLowerCase() === email);
    if (user) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('company_id')
        .eq('owner_id', user.id)
        .maybeSingle();
      const companyId = tenant?.company_id || user.user_metadata?.company_id;
      if (companyId) {
        const smtp = await getCompanySmtp(supabaseAdmin, companyId);
        if (smtp) {
          console.log(`Resolved SMTP via user → company ${companyId}`);
          return smtp;
        }
      }
    }
  } catch (e) {
    console.error('resolveSmtpConfig user lookup error:', e);
  }

  // Priority 3: global SMTP fallback
  const smtpUser = (Deno.env.get('SMTP_USER') || '').trim();
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  if (!smtpUser || !smtpPassword) return null;

  return {
    host: 'smtp.gmail.com',
    port: 465,
    user: smtpUser,
    password: smtpPassword,
    fromEmail: smtpUser,
    fromName: 'VKHO',
    source: 'global',
  };
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

    // Rate limit
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
    // Extract hostname from redirectUrl or explicit field (so SMTP matches the company owning current domain)
    let hostname = String(body.hostname || '').trim().toLowerCase();
    if (!hostname && redirectUrl) {
      try { hostname = new URL(redirectUrl).hostname.toLowerCase(); } catch {}
    }

    if (!email || !validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Email không hợp lệ" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Resolve SMTP (priority: domain → user tenant → global)
    const smtp = await resolveSmtpConfig(supabaseAdmin, email, hostname);
    if (!smtp) {
      console.error('No SMTP config available');
      return new Response(
        JSON.stringify({ error: "Cấu hình email chưa hoàn tất" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Using ${smtp.source} SMTP (${smtp.host}) for ${email}`);

    // Generate recovery link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirectUrl },
    });

    if (linkError) {
      console.error("Generate link error:", linkError);
      return new Response(
        JSON.stringify({ success: true, message: "Nếu email tồn tại, link khôi phục đã được gửi." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      return new Response(
        JSON.stringify({ success: true, message: "Nếu email tồn tại, link khôi phục đã được gửi." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const brandName = smtp.companyName || smtp.fromName || 'VKHO';

    // RFC 2047 encode for UTF-8 headers (subject, from name with Vietnamese chars)
    const encodeHeader = (text: string): string => {
      // eslint-disable-next-line no-control-regex
      if (/^[\x00-\x7F]*$/.test(text)) return text;
      const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
      return `=?UTF-8?B?${b64}?=`;
    };

    const subjectText = `Khôi phục mật khẩu - ${brandName}`;
    const encodedSubject = encodeHeader(subjectText);
    const encodedFromName = encodeHeader(smtp.fromName);

    const client = new SMTPClient({
      connection: {
        hostname: smtp.host,
        port: smtp.port,
        tls: smtp.port === 465,
        auth: {
          username: smtp.user,
          password: smtp.password,
        },
      },
    });

    const emailHtml = [
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">',
      '<div style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0;">',
      `<h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">${brandName}</h1>`,
      '<p style="color:#dbeafe;margin:8px 0 0 0;font-size:14px;">Hệ thống quản lý</p>',
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
      `© ${new Date().getFullYear()} ${brandName}</div>`,
      '</div>',
    ].join('');

    try {
      await client.send({
        from: `${encodedFromName} <${smtp.fromEmail}>`,
        to: email,
        subject: encodedSubject,
        content: 'Vui lòng mở email bằng ứng dụng hỗ trợ HTML để xem nội dung khôi phục mật khẩu.',
        html: emailHtml,
      });
      await client.close();
    } catch (sendErr: any) {
      const rawMsg = String(sendErr?.message || sendErr || '');
      console.error(`SMTP send failed (${smtp.source}):`, rawMsg);
      try { await client.close(); } catch {}

      const translateSmtpError = (msg: string): string => {
        const m = msg.toLowerCase();
        if (m.includes('webloginrequired') || m.includes('5.7.9') || m.includes('invalid login') || m.includes('username and password not accepted')) {
          return `Gmail từ chối đăng nhập SMTP (tài khoản ${smtp.user}). Mật khẩu ứng dụng (App Password) đã hết hạn hoặc bị thu hồi. Vui lòng vào Cài đặt Email công ty để cập nhật App Password mới.`;
        }
        if (m.includes('eauth') || m.includes('authentication failed') || m.includes('535')) {
          return `Sai thông tin đăng nhập SMTP (${smtp.user}). Vui lòng kiểm tra lại tài khoản và mật khẩu ứng dụng trong Cài đặt Email.`;
        }
        if (m.includes('econnrefused') || m.includes('etimedout') || m.includes('enotfound')) {
          return `Không kết nối được tới máy chủ SMTP (${smtp.host}:${smtp.port}). Vui lòng kiểm tra cấu hình host/port.`;
        }
        if (m.includes('rate') || m.includes('quota')) {
          return `SMTP đã đạt giới hạn gửi. Vui lòng thử lại sau.`;
        }
        return `Gửi email thất bại (${smtp.source === 'company' ? 'SMTP công ty' : 'SMTP hệ thống'}): ${msg.slice(0, 200)}`;
      };

      // If company SMTP failed, try global as last resort
      if (smtp.source === 'company') {
        const fallbackUser = (Deno.env.get('SMTP_USER') || '').trim();
        const fallbackPass = Deno.env.get('SMTP_PASSWORD');
        if (fallbackUser && fallbackPass) {
          try {
            const fallback = new SMTPClient({
              connection: {
                hostname: 'smtp.gmail.com',
                port: 465,
                tls: true,
                auth: { username: fallbackUser, password: fallbackPass },
              },
            });
            await fallback.send({
              from: `${encodeHeader('VKHO')} <${fallbackUser}>`,
              to: email,
              subject: encodeHeader('Khôi phục mật khẩu - VKHO'),
              content: 'Vui lòng mở email bằng ứng dụng hỗ trợ HTML.',
              html: emailHtml,
            });
            await fallback.close();
            console.log('Sent via global SMTP fallback');
          } catch (fbErr: any) {
            console.error('Fallback SMTP also failed:', fbErr?.message || fbErr);
            return new Response(
              JSON.stringify({ error: translateSmtpError(String(fbErr?.message || fbErr || '')) }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ error: translateSmtpError(rawMsg) }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: translateSmtpError(rawMsg) }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log(`Password reset email sent to ${email} via ${smtp.source}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email khôi phục mật khẩu đã được gửi.", source: smtp.source }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Không thể gửi email khôi phục" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
