import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!smtpUser || !smtpPassword) {
      return new Response(
        JSON.stringify({ error: "SMTP not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let filterAutomationId: string | null = null;
    try {
      const body = await req.json();
      filterAutomationId = body?.automation_id || null;
    } catch { /* no body */ }

    let query = supabase
      .from("platform_email_automations")
      .select("*")
      .eq("is_enabled", true);
    if (filterAutomationId) query = query.eq("id", filterAutomationId);

    const { data: automations, error: autoErr } = await query;
    if (autoErr) throw autoErr;
    if (!automations?.length) {
      return new Response(
        JSON.stringify({ message: "No active automations", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
      pool: true,
      maxConnections: 1,
      maxMessages: 100,
      rateDelta: 1500,
      rateLimit: 1,
    });

    let totalSent = 0;
    const debugInfo: string[] = [];

    for (const automation of automations) {
      const { trigger_type, trigger_days, target_audience, subject, html_content, id: automationId } = automation;

      // Use RPC to get all eligible tenants with admin email + last_sign_in in ONE SQL query
      const { data: tenants, error: rpcErr } = await supabase.rpc('get_automation_eligible_tenants', {
        p_target_audience: target_audience || 'all',
        p_trigger_type: trigger_type,
        p_trigger_days: trigger_days,
      });

      if (rpcErr) {
        debugInfo.push(`${automation.name}: RPC error - ${rpcErr.message}`);
        continue;
      }
      if (!tenants?.length) {
        debugInfo.push(`${automation.name}: 0 tenants`);
        continue;
      }

      debugInfo.push(`${automation.name}: ${tenants.length} tenants`);
      const now = new Date();
      let sent = 0;

      for (const t of tenants) {
        const daysSinceCreation = t.days_since_creation || 0;
        const daysSinceLogin = t.days_since_login || daysSinceCreation;
        const tenantName = t.tenant_name || t.subdomain || "Bạn";
        const recipientEmail = t.admin_email;

        let shouldSend = false;

        switch (trigger_type) {
          case "signup_days":
            shouldSend = daysSinceCreation === trigger_days;
            break;
          case "inactive_days":
            shouldSend = daysSinceLogin >= trigger_days;
            break;
          case "no_login_since": {
            if (daysSinceLogin >= trigger_days) {
              const { data: existing } = await supabase
                .from("platform_email_automation_logs")
                .select("id")
                .eq("automation_id", automationId)
                .eq("tenant_id", t.tenant_id)
                .limit(1);
              shouldSend = !existing?.length;
            }
            break;
          }
          case "trial_expiring": {
            const endDateStr = t.trial_end_date || t.subscription_end_date;
            if (t.status === "trial" && endDateStr) {
              const daysUntil = Math.floor((new Date(endDateStr).getTime() - now.getTime()) / 86400000);
              shouldSend = daysUntil <= trigger_days && daysUntil >= 0;
            }
            break;
          }
          case "no_import": {
            if (daysSinceCreation >= trigger_days) {
              const { count } = await supabase
                .from("import_receipts")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", t.tenant_id);
              shouldSend = (count || 0) === 0;
            }
            break;
          }
          case "no_export": {
            if (daysSinceCreation >= trigger_days) {
              const { count } = await supabase
                .from("export_receipts")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", t.tenant_id);
              shouldSend = (count || 0) === 0;
            }
            break;
          }
          case "post_purchase_days": {
            const { data: lastExport } = await supabase
              .from("export_receipts")
              .select("export_date")
              .eq("tenant_id", t.tenant_id)
              .eq("status", "completed")
              .order("export_date", { ascending: false })
              .limit(1)
              .single();
            if (lastExport?.export_date) {
              const days = Math.floor((now.getTime() - new Date(lastExport.export_date).getTime()) / 86400000);
              if (days >= trigger_days) {
                const { data: existing } = await supabase
                  .from("platform_email_automation_logs")
                  .select("id")
                  .eq("automation_id", automationId)
                  .eq("tenant_id", t.tenant_id)
                  .limit(1);
                shouldSend = !existing?.length;
              }
            }
            break;
          }
        }

        if (!shouldSend) continue;

        // Dedup: already sent today
        if (trigger_type !== "no_login_since" && trigger_type !== "post_purchase_days") {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const { data: todayLog } = await supabase
            .from("platform_email_automation_logs")
            .select("id")
            .eq("automation_id", automationId)
            .eq("tenant_id", t.tenant_id)
            .gte("created_at", todayStart.toISOString())
            .limit(1);
          if (todayLog?.length) continue;
        }

        const finalSubject = subject
          .replace(/\{\{tenant_name\}\}/g, tenantName)
          .replace(/\{\{trigger_days\}\}/g, String(trigger_days));
        const finalHtml = html_content
          .replace(/\{\{tenant_name\}\}/g, tenantName)
          .replace(/\{\{email\}\}/g, recipientEmail)
          .replace(/\{\{store_name\}\}/g, t.subdomain || "")
          .replace(/\{\{trigger_days\}\}/g, String(trigger_days));

        const fullHtml = [
          '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#f9fafb;border-radius:12px;overflow:hidden">',
            '<div style="background:linear-gradient(135deg,#1a56db,#2563eb);color:#fff;padding:24px;text-align:center">',
              `<h1 style="margin:0;font-size:20px;font-weight:bold">${finalSubject}</h1>`,
            '</div>',
            '<div style="background:#fff;padding:24px">',
              finalHtml,
            '</div>',
            '<div style="background:#f3f4f6;padding:16px 24px;text-align:center">',
              '<p style="margin:0;font-size:12px;color:#9ca3af">© 2026 VKHO – Hệ thống quản lý kho hàng thông minh</p>',
            '</div>',
          '</div>',
        ].join('');

        try {
          await transporter.sendMail({
            from: `"VKHO" <${smtpUser}>`,
            to: recipientEmail,
            subject: finalSubject,
            html: fullHtml,
          });

          await supabase.from("platform_email_automation_logs").insert({
            automation_id: automationId,
            tenant_id: t.tenant_id,
            recipient_email: recipientEmail,
            recipient_name: tenantName,
            subject: finalSubject,
            status: "sent",
            sent_at: new Date().toISOString(),
            body_html: fullHtml,
          });

          totalSent++;
          sent++;
          console.log(`✅ ${recipientEmail} (${automation.name})`);
        } catch (sendError: any) {
          console.error(`❌ ${recipientEmail}: ${sendError.message}`);
          await supabase.from("platform_email_automation_logs").insert({
            automation_id: automationId,
            tenant_id: t.tenant_id,
            recipient_email: recipientEmail,
            recipient_name: tenantName,
            subject: finalSubject,
            status: "error",
            error_message: sendError.message,
            body_html: fullHtml,
          });
        }
      }
      debugInfo.push(`  → sent: ${sent}`);
    }

    transporter.close();

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, debug: debugInfo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Platform email automation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
