import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all enabled automations
    const { data: automations, error: autoErr } = await supabase
      .from("platform_email_automations")
      .select("*")
      .eq("is_enabled", true);

    if (autoErr) throw autoErr;
    if (!automations || automations.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active automations", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;

    for (const automation of automations) {
      const { trigger_type, trigger_days, target_audience, subject, html_content, id: automationId } = automation;

      // Build tenant query based on target_audience
      let query = supabase
        .from("tenants")
        .select("id, name, subdomain, status, subscription_plan, subscription_end_date, created_at, last_login_at");

      // Filter by audience
      switch (target_audience) {
        case "active":
          query = query.eq("status", "active");
          break;
        case "trial":
          query = query.eq("status", "trial");
          break;
        case "free":
          query = query.eq("status", "expired");
          break;
        case "paid":
          query = query.in("status", ["active", "trial"]).not("subscription_plan", "is", null);
          break;
        default: // 'all'
          query = query.in("status", ["active", "trial", "expired"]);
          break;
      }

      const { data: tenants, error: tenantErr } = await query;
      if (tenantErr || !tenants) continue;

      const now = new Date();

      for (const tenant of tenants) {
        // Get owner email
        const { data: platformUser } = await supabase
          .from("platform_users")
          .select("user_id")
          .eq("tenant_id", tenant.id)
          .eq("platform_role", "tenant_owner")
          .limit(1)
          .single();

        if (!platformUser) continue;

        const { data: authUser } = await supabase.auth.admin.getUserById(platformUser.user_id);
        if (!authUser?.user?.email) continue;

        const recipientEmail = authUser.user.email;
        const tenantName = tenant.name || tenant.subdomain || "Bạn";
        const createdAt = new Date(tenant.created_at);
        const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        let shouldSend = false;

        switch (trigger_type) {
          case "signup_days": {
            // Send on the exact day
            shouldSend = daysSinceCreation === trigger_days;
            break;
          }
          case "inactive_days": {
            const lastLogin = tenant.last_login_at ? new Date(tenant.last_login_at) : null;
            if (lastLogin) {
              const daysSinceLogin = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
              shouldSend = daysSinceLogin >= trigger_days;
            }
            break;
          }
          case "no_login_since": {
            // Only send ONCE - check if already sent
            const lastLogin = tenant.last_login_at ? new Date(tenant.last_login_at) : createdAt;
            const daysSinceLogin = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceLogin >= trigger_days) {
              // Check if already sent for this automation + tenant
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
            if (tenant.status === "trial" && tenant.subscription_end_date) {
              const endDate = new Date(tenant.subscription_end_date);
              const daysUntilExpiry = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              shouldSend = daysUntilExpiry <= trigger_days && daysUntilExpiry >= 0;
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
            // Check last export (sale) date, only send ONCE
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
                // Check if already sent for this automation + tenant (send only once)
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

          if (todayLog && todayLog.length > 0) continue;
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

        // Send email via send-bulk-email function
        try {
          const { error: sendErr } = await supabase.functions.invoke("send-bulk-email", {
            body: {
              emails: [recipientEmail],
              subject: finalSubject,
              htmlContent: finalHtml,
            },
          });

          // Log result
          await supabase.from("platform_email_automation_logs").insert({
            automation_id: automationId,
            tenant_id: tenant.id,
            recipient_email: recipientEmail,
            recipient_name: tenantName,
            subject: finalSubject,
            status: sendErr ? "error" : "sent",
            error_message: sendErr?.message || null,
            sent_at: sendErr ? null : new Date().toISOString(),
          });

          if (!sendErr) totalSent++;
        } catch (sendError: any) {
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

    return new Response(
      JSON.stringify({ success: true, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
