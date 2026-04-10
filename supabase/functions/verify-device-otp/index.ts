import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { action, device_id, otp_code } = await req.json();

    if (action === "send") {
      // Generate OTP and store it
      if (!device_id) throw new Error("Missing device_id");

      const { data: device } = await supabase
        .from("trusted_devices")
        .select("*, profiles!trusted_devices_user_id_fkey(display_name, tenant_id)")
        .eq("id", device_id)
        .single();

      if (!device) throw new Error("Device not found");

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      // Store OTP in device metadata
      await supabase
        .from("trusted_devices")
        .update({
          otp_code: otp,
          otp_expires_at: expiresAt,
        })
        .eq("id", device_id);

      // In production, send OTP via email/SMS
      // For now, return it (admin can see it)
      return new Response(
        JSON.stringify({ success: true, message: "OTP đã được tạo", otp_preview: otp }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      if (!device_id || !otp_code) throw new Error("Missing device_id or otp_code");

      const { data: device } = await supabase
        .from("trusted_devices")
        .select("*")
        .eq("id", device_id)
        .eq("user_id", user.id)
        .single();

      if (!device) throw new Error("Device not found");
      if (device.otp_code !== otp_code) throw new Error("Mã OTP không đúng");
      if (new Date(device.otp_expires_at) < new Date()) throw new Error("Mã OTP đã hết hạn");

      // Approve device
      await supabase
        .from("trusted_devices")
        .update({
          status: "approved",
          otp_code: null,
          otp_expires_at: null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", device_id);

      return new Response(
        JSON.stringify({ success: true, message: "Thiết bị đã được xác nhận" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
