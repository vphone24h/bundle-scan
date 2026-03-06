import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "vkho_security_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("security-password called");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("No auth header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Try getClaims first, fall back to getUser
    let userId: string;
    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: claimsData, error: claimsError } = await (supabaseUser.auth as any).getClaims(token);
      if (claimsError || !claimsData?.claims) {
        throw new Error("getClaims failed");
      }
      userId = claimsData.claims.sub;
      console.log("Auth via getClaims, userId:", userId);
    } catch {
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        console.log("Auth failed:", userError?.message);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
      console.log("Auth via getUser, userId:", userId);
    }

    // Get tenant_id and role
    const { data: platformUser } = await supabaseAdmin
      .from("platform_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();
    if (!platformUser) {
      return new Response(JSON.stringify({ error: "No tenant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = platformUser.tenant_id;
    const body = await req.json();
    const { action } = body;
    console.log("action:", action, "tenantId:", tenantId);

    if (action === "set_password") {
      // Only super_admin can set
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("user_role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .single();
      if (roleData?.user_role !== "super_admin") {
        return new Response(JSON.stringify({ error: "Chỉ Admin Tổng mới được đặt mật khẩu bảo mật" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { password, old_password } = body;
      console.log("set_password: has old_password:", !!old_password, "password length:", password?.length);
      if (!password || password.length < 4) {
        return new Response(JSON.stringify({ error: "Mật khẩu phải có ít nhất 4 ký tự" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if password already exists (changing vs setting)
      const { data: existingPw, error: existErr } = await supabaseAdmin
        .from("security_passwords")
        .select("password_hash")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      console.log("existingPw:", !!existingPw, "existErr:", existErr?.message);

      if (existingPw) {
        // Changing password - must verify old password
        if (!old_password) {
          return new Response(JSON.stringify({ error: "Phải nhập mật khẩu cũ để đổi mật khẩu" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const oldHashed = await hashPassword(old_password);
        const match = existingPw.password_hash === oldHashed;
        console.log("old password match:", match);
        if (!match) {
          return new Response(JSON.stringify({ error: "Mật khẩu cũ không đúng" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const hashed = await hashPassword(password);
      const { error: upsertErr } = await supabaseAdmin
        .from("security_passwords")
        .upsert({ tenant_id: tenantId, password_hash: hashed, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
      console.log("upsert result:", upsertErr?.message || "success");
      if (upsertErr) throw upsertErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify_password") {
      const { password } = body;
      const hashed = await hashPassword(password);
      const { data: record } = await supabaseAdmin
        .from("security_passwords")
        .select("password_hash")
        .eq("tenant_id", tenantId)
        .single();

      if (!record) {
        return new Response(JSON.stringify({ error: "Chưa đặt mật khẩu bảo mật" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const valid = record.password_hash === hashed;
      return new Response(JSON.stringify({ valid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove_password") {
      // Only super_admin
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("user_role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .single();
      if (roleData?.user_role !== "super_admin") {
        return new Response(JSON.stringify({ error: "Không có quyền" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify current password first
      const { password } = body;
      const hashed = await hashPassword(password);
      const { data: record } = await supabaseAdmin
        .from("security_passwords")
        .select("password_hash")
        .eq("tenant_id", tenantId)
        .single();
      if (!record || record.password_hash !== hashed) {
        return new Response(JSON.stringify({ error: "Mật khẩu không đúng" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("security_passwords").delete().eq("tenant_id", tenantId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "request_reset_otp") {
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      await supabaseAdmin
        .from("security_passwords")
        .update({ reset_otp: otp, reset_otp_expires_at: expiresAt })
        .eq("tenant_id", tenantId);

      // Get owner email
      const { data: ownerRole } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_role", "super_admin")
        .single();

      if (ownerRole) {
        const { data: ownerAuth } = await supabaseAdmin.auth.admin.getUserById(ownerRole.user_id);
        const email = ownerAuth?.user?.email;
        if (email) {
          // Send OTP email via Resend
          const resendKey = Deno.env.get("RESEND_API_KEY");
          if (resendKey) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "VKho <noreply@vkho.vn>",
                to: [email],
                subject: "Mã OTP khôi phục mật khẩu bảo mật",
                html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
                  <h2>Khôi phục mật khẩu bảo mật</h2>
                  <p>Mã OTP của bạn là:</p>
                  <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f0f0f0;border-radius:8px;">${otp}</div>
                  <p style="color:#666;margin-top:16px;">Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
                </div>`,
              }),
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, message: "OTP đã được gửi về email chủ cửa hàng" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify_reset_otp") {
      const { otp, new_password } = body;
      const { data: record } = await supabaseAdmin
        .from("security_passwords")
        .select("reset_otp, reset_otp_expires_at")
        .eq("tenant_id", tenantId)
        .single();

      if (!record || record.reset_otp !== otp) {
        return new Response(JSON.stringify({ error: "Mã OTP không đúng" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(record.reset_otp_expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Mã OTP đã hết hạn" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hashed = await hashPassword(new_password);
      await supabaseAdmin
        .from("security_passwords")
        .update({ password_hash: hashed, reset_otp: null, reset_otp_expires_at: null, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("security-password error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
