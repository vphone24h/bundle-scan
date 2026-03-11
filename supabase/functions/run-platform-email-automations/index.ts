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

    // === BATCH PRE-FETCH: all tenant admins with email ===
    const { data: allAdmins } = await supabase
      .from("platform_users")
      .select("user_id, tenant_id, email")
      .eq("platform_role", "tenant_admin");

    const adminByTenant: Record<string, { user_id: string; email: string | null }> = {};
    const allUserIds = new Set<string>();
    for (const a of allAdmins || []) {
      if (!adminByTenant[a.tenant_id]) {
        adminByTenant[a.tenant_id] = { user_id: a.user_id, email: a.email };
        allUserIds.add(a.user_id);
      }
    }

    // === BATCH PRE-FETCH: auth users (email + last_sign_in_at) ===
    // Use listUsers with pagination to get all users efficiently
    const authUserMap: Record<string, { email: string; last_sign_in_at: string | null }> = {};
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage });
      if (listErr || !users?.length) break;
      for (const u of users) {
        if (allUserIds.has(u.id)) {
          authUserMap[u.id] = { email: u.email || '', last_sign_in_at: u.last_sign_in_at || null };
        }
      }
      if (users.length < perPage) break;
      page++;
    }

    // Resolve final email + last_sign_in for each tenant
    interface TenantAdmin { email: string; lastSignIn: Date | null; }
    const resolvedAdmins: Record<string, TenantAdmin> = {};
    for (const [tenantId, admin] of Object.entries(adminByTenant)) {
      const authInfo = authUserMap[admin.user_id];
      const email = admin.email || authInfo?.email;
      if (!email) continue;
      resolvedAdmins[tenantId] = {
        email,
        lastSignIn: authInfo?.last_sign_in_at ? new Date(authInfo.last_sign_in_at) : null,
      };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
      pool: true,
      maxConnections: 1,
      maxMessages: 50,
      rateDelta: 1500,
      rateLimit: 1,
    });

    let totalSent = 0;
    const debugInfo: string[] = [];

    for (const automation of automations) {
      const { trigger_type, trigger_days, target_audience, subject, html_content, id: automationId } = automation;

      let tenantQuery = supabase
        .from("tenants")
        .select("id, name, subdomain, status, subscription_plan, subscription_end_date, trial_end_date, created_at");

      switch (target_audience) {
        case "active": tenantQuery = tenantQuery.eq("status", "active"); break;
        case "trial": tenantQuery = tenantQuery.eq("status", "trial"); break;
        case "free": tenantQuery = tenantQuery.eq("status", "expired"); break;
        case "paid": tenantQuery = tenantQuery.in("status", ["active", "trial"]).not("subscription_plan", "is", null); break;
        default: tenantQuery = tenantQuery.in("status", ["active", "trial", "expired"]); break;
      }

      const { data: tenants, error: tenantErr } = await tenantQuery;
      if (tenantErr || !tenants?.length) {
        debugInfo.push(`${automation.name}: ${tenantErr?.message || 'no tenants'}`);
        continue;
      }

      debugInfo.push(`${automation.name}: ${tenants.length} tenants matched`);
      const now = new Date();
      let automationSent = 0;
      let automationSkipped = 0;

      for (const tenant of tenants) {
        const admin = resolvedAdmins[tenant.id];
        if (!admin) continue;

        const { email: recipientEmail, lastSignIn } = admin;
        const tenantName = tenant.name || tenant.subdomain || "Bạn";
        const createdAt = new Date(tenant.created_at);
        const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        let shouldSend = false;

        switch (trigger_type) {
          case "signup_days":
            shouldSend = daysSinceCreation === trigger_days;
            break;
          case "inactive_days": {
            if (lastSignIn) {
              const days = Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24));
              shouldSend = days >= trigger_days;
            } else {
              shouldSend = daysSinceCreation >= trigger_days;
            }
            break;
          }
          case "no_login_since": {
            const refDate = lastSignIn || createdAt;
            const days = Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
            if (days >= trigger_days) {
              const { data: existing } = await supabase
                .from("platform_email_automation_logs")
                .select("id")
                .eq("automation_id", automationId)
                .eq("tenant_id", tenant.id)
                .limit(1);
              shouldSend = !existing?.length;
            }
            break;
          }
          case "trial_expiring": {
            const endDateStr = tenant.trial_end_date || tenant.subscription_end_date;
            if (tenant.status === "trial" && endDateStr) {
              const endDate = new Date(endDateStr);
              const daysUntil = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              shouldSend = daysUntil <= trigger_days && daysUntil >= 0;
            }
            break;
          }
          case "no_import": {
            if (daysSinceCreation >= trigger_days) {
              const { count } = await supabase
                .from("import_receipts")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", tenant.id);
              shouldSend = (count || 0) === 0;
            }
            break;
          }
          case "no_export": {
            if (daysSinceCreation >= trigger_days) {
              const { count } = await supabase
                .from("export_receipts")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", tenant.id);
              shouldSend = (count || 0) === 0;
            }
            break;
          }
          case "post_purchase_days": {
            const { data: lastExport } = await supabase
              .from("export_receipts")
              .select("export_date")
              .eq("tenant_id", tenant.id)
              .eq("status", "completed")
              .order("export_date", { ascending: false })
              .limit(1)
              .single();
            if (lastExport?.export_date) {
              const days = Math.floor((now.getTime() - new Date(lastExport.export_date).getTime()) / (1000 * 60 * 60 * 24));
              if (days >= trigger_days) {
                const { data: existing } = await supabase
                  .from("platform_email_automation_logs")
                  .select("id")
                  .eq("automation_id", automationId)
                  .eq("tenant_id", tenant.id)
                  .limit(1);
                shouldSend = !existing?.length;
              }
            }
            break;
          }
        }

        if (!shouldSend) { automationSkipped++; continue; }

        // Dedup: already sent today
        if (trigger_type !== "no_login_since" && trigger_type !== "post_purchase_days") {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const { data: todayLog } = await supabase
            .from("platform_email_automation_logs")
            .select("id")
            .eq("automation_id", automationId)
            .eq("tenant_id", tenant.id)
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
          .replace(/\{\{store_name\}\}/g, tenant.subdomain || "")
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
            tenant_id: tenant.id,
            recipient_email: recipientEmail,
            recipient_name: tenantName,
            subject: finalSubject,
            status: "sent",
            sent_at: new Date().toISOString(),
          });

          totalSent++;
          automationSent++;
          console.log(`✅ ${recipientEmail} (${automation.name})`);
        } catch (sendError: any) {
          console.error(`❌ ${recipientEmail}: ${sendError.message}`);
          await supabase.from("platform_email_automation_logs").insert({
            automation_id: automationId,
            tenant_id: tenant.id,
            recipient_email: recipientEmail,
            recipient_name: tenantName,
            subject: finalSubject,
            status: "error",
            error_message: sendError.message,
          });
        }
      }

      debugInfo.push(`  → sent: ${automationSent}, skipped: ${automationSkipped}`);
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
