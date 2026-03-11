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

    // Parse optional automation_id filter
    let filterAutomationId: string | null = null;
    try {
      const body = await req.json();
      filterAutomationId = body?.automation_id || null;
    } catch { /* no body or not JSON */ }

    // Get automations (optionally filtered by id)
    let query = supabase
      .from("platform_email_automations")
      .select("*")
      .eq("is_enabled", true);
    
    if (filterAutomationId) {
      query = query.eq("id", filterAutomationId);
    }

    const { data: automations, error: autoErr } = await query;

    if (autoErr) throw autoErr;
    if (!automations || automations.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active automations", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
      pool: true,
      maxConnections: 1,
      maxMessages: 10,
      rateDelta: 2000,
      rateLimit: 1,
    });

    let totalSent = 0;
    const debugInfo: any[] = [];

    for (const automation of automations) {
      const { trigger_type, trigger_days, target_audience, subject, html_content, id: automationId } = automation;

      // Query tenants with ONLY existing columns
      let tenantQuery = supabase
        .from("tenants")
        .select("id, name, subdomain, status, subscription_plan, subscription_end_date, trial_end_date, created_at");

      // Filter by audience
      switch (target_audience) {
        case "active":
          tenantQuery = tenantQuery.eq("status", "active");
          break;
        case "trial":
          tenantQuery = tenantQuery.eq("status", "trial");
          break;
        case "free":
          tenantQuery = tenantQuery.eq("status", "expired");
          break;
        case "paid":
          tenantQuery = tenantQuery.in("status", ["active", "trial"]).not("subscription_plan", "is", null);
          break;
        default: // 'all'
          tenantQuery = tenantQuery.in("status", ["active", "trial", "expired"]);
          break;
      }

      const { data: tenants, error: tenantErr } = await tenantQuery;
      if (tenantErr) {
        console.error(`❌ Tenant query error for automation ${automation.name}:`, tenantErr.message);
        debugInfo.push({ automation: automation.name, error: `Tenant query: ${tenantErr.message}` });
        continue;
      }
      if (!tenants || tenants.length === 0) {
        console.log(`ℹ️ No tenants matched for automation "${automation.name}" (audience: ${target_audience})`);
        debugInfo.push({ automation: automation.name, message: "No tenants matched", audience: target_audience });
        continue;
      }

      console.log(`📋 Automation "${automation.name}": ${tenants.length} tenants matched`);

      const now = new Date();

      for (const tenant of tenants) {
        // Get owner user
        const { data: platformUser } = await supabase
          .from("platform_users")
          .select("user_id")
          .eq("tenant_id", tenant.id)
          .eq("platform_role", "tenant_admin")
          .limit(1)
          .single();

        if (!platformUser) {
          continue;
        }

        const { data: authUser } = await supabase.auth.admin.getUserById(platformUser.user_id);
        if (!authUser?.user?.email) continue;

        const recipientEmail = authUser.user.email;
        const tenantName = tenant.name || tenant.subdomain || "Bạn";
        const createdAt = new Date(tenant.created_at);
        const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        // Get last_sign_in_at from auth.users for inactive triggers
        const lastSignIn = authUser.user.last_sign_in_at ? new Date(authUser.user.last_sign_in_at) : null;

        let shouldSend = false;

        switch (trigger_type) {
          case "signup_days": {
            shouldSend = daysSinceCreation === trigger_days;
            console.log(`  📌 ${tenantName}: signup_days check - days=${daysSinceCreation}, target=${trigger_days}, match=${shouldSend}`);
            break;
          }
          case "inactive_days": {
            if (lastSignIn) {
              const daysSinceLogin = Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24));
              shouldSend = daysSinceLogin >= trigger_days;
              console.log(`  📌 ${tenantName}: inactive_days check - daysSinceLogin=${daysSinceLogin}, target=${trigger_days}, match=${shouldSend}`);
            } else {
              // Never logged in → consider inactive since creation
              shouldSend = daysSinceCreation >= trigger_days;
              console.log(`  📌 ${tenantName}: inactive_days (never logged in) - daysSinceCreation=${daysSinceCreation}, target=${trigger_days}, match=${shouldSend}`);
            }
            break;
          }
          case "no_login_since": {
            const refDate = lastSignIn || createdAt;
            const daysSinceLogin = Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceLogin >= trigger_days) {
              // Only send once ever
              const { data: existingLog } = await supabase
                .from("platform_email_automation_logs")
                .select("id")
                .eq("automation_id", automationId)
                .eq("tenant_id", tenant.id)
                .limit(1);

              shouldSend = !existingLog || existingLog.length === 0;
            }
            break;
          }
          case "trial_expiring": {
            // Use trial_end_date first, then subscription_end_date
            const endDateStr = tenant.trial_end_date || tenant.subscription_end_date;
            if (tenant.status === "trial" && endDateStr) {
              const endDate = new Date(endDateStr);
              const daysUntilExpiry = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              shouldSend = daysUntilExpiry <= trigger_days && daysUntilExpiry >= 0;
              console.log(`  📌 ${tenantName}: trial_expiring check - daysUntil=${daysUntilExpiry}, target=${trigger_days}, match=${shouldSend}`);
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
              const lastExportDate = new Date(lastExport.export_date);
              const daysSinceExport = Math.floor((now.getTime() - lastExportDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysSinceExport >= trigger_days) {
                const { data: existingLog } = await supabase
                  .from("platform_email_automation_logs")
                  .select("id")
                  .eq("automation_id", automationId)
                  .eq("tenant_id", tenant.id)
                  .limit(1);

                shouldSend = !existingLog || existingLog.length === 0;
              }
            }
            break;
          }
        }

        if (!shouldSend) continue;

        // Check if email already sent today for this automation + tenant (except once-only types)
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

          if (todayLog && todayLog.length > 0) {
            console.log(`  ⏭️ ${tenantName}: already sent today, skipping`);
            continue;
          }
        }

        // Replace variables in content
        const finalSubject = subject
          .replace(/\{\{tenant_name\}\}/g, tenantName)
          .replace(/\{\{trigger_days\}\}/g, String(trigger_days));
        const finalHtml = html_content
          .replace(/\{\{tenant_name\}\}/g, tenantName)
          .replace(/\{\{email\}\}/g, recipientEmail)
          .replace(/\{\{store_name\}\}/g, tenant.subdomain || "")
          .replace(/\{\{trigger_days\}\}/g, String(trigger_days));

        // Wrap in email template
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

        // Send email directly via SMTP
        try {
          await transporter.sendMail({
            from: `"VKHO" <${smtpUser}>`,
            to: recipientEmail,
            subject: finalSubject,
            html: fullHtml,
          });

          // Log success
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
          console.log(`✅ Sent to ${recipientEmail} (automation: ${automation.name})`);
        } catch (sendError: any) {
          console.error(`❌ Failed to send to ${recipientEmail}:`, sendError.message);
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
    }

    // Close transporter pool
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
