import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { period_id, tenant_id } = await req.json();
    if (!period_id || !tenant_id) throw new Error("Missing period_id or tenant_id");

    // Get period
    const { data: period, error: periodErr } = await supabase
      .from("payroll_periods")
      .select("*")
      .eq("id", period_id)
      .eq("tenant_id", tenant_id)
      .single();
    if (periodErr || !period) throw new Error("Period not found");

    // Get all employees with salary templates
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, tenant_id")
      .eq("tenant_id", tenant_id);

    if (!profiles?.length) {
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get salary templates
    const { data: templates } = await supabase
      .from("salary_templates")
      .select("*")
      .eq("tenant_id", tenant_id);

    const templateMap = new Map((templates || []).map((t: any) => [t.user_id, t]));

    // Get attendance records for the period
    const { data: attendance } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("tenant_id", tenant_id)
      .gte("date", period.start_date)
      .lte("date", period.end_date);

    // Get commission rules
    const { data: commRules } = await supabase
      .from("commission_rules")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true);

    // Get salary advances for the period
    const { data: advances } = await supabase
      .from("salary_advances")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("payroll_period_id", period_id)
      .eq("status", "approved");

    const results: any[] = [];

    for (const profile of profiles) {
      const tpl = templateMap.get(profile.id) as any;
      if (!tpl) continue;

      const userAttendance = (attendance || []).filter((a: any) => a.user_id === profile.id);
      const workDays = userAttendance.filter((a: any) => a.check_in_time && a.status !== "absent").length;
      const totalMinutes = userAttendance.reduce((s: number, a: any) => s + (a.total_work_minutes || 0), 0);
      const lateCount = userAttendance.filter((a: any) => a.status === "late").length;
      const overtimeMinutes = userAttendance.reduce((s: number, a: any) => s + (a.overtime_minutes || 0), 0);

      // Base salary calculation
      let baseSalary = 0;
      const salaryType = tpl.salary_type || "monthly";
      if (salaryType === "monthly") {
        baseSalary = tpl.base_salary || 0;
      } else if (salaryType === "daily") {
        baseSalary = (tpl.base_salary || 0) * workDays;
      } else if (salaryType === "hourly") {
        baseSalary = (tpl.base_salary || 0) * (totalMinutes / 60);
      } else if (salaryType === "shift") {
        baseSalary = (tpl.base_salary || 0) * workDays;
      }

      // Allowances
      const allowances = tpl.allowances || {};
      const totalAllowance = Object.values(allowances).reduce((s: number, v: any) => s + (Number(v) || 0), 0);

      // Deductions
      const deductions = tpl.deductions || {};
      const totalDeduction = Object.values(deductions).reduce((s: number, v: any) => s + (Number(v) || 0), 0);

      // Commission (simplified - use commission_rules)
      let totalCommission = 0;
      const userRules = (commRules || []).filter(
        (r: any) => !r.applies_to_user_id || r.applies_to_user_id === profile.id
      );
      // Commission would be calculated from order data in production
      // For now, include any fixed commissions
      for (const rule of userRules) {
        if (rule.commission_type === "fixed") {
          totalCommission += rule.commission_value || 0;
        }
      }

      // Overtime pay
      const overtimePay = (overtimeMinutes / 60) * ((tpl.base_salary || 0) / 22 / 8) * 1.5;

      // Advances deduction
      const userAdvances = (advances || []).filter((a: any) => a.user_id === profile.id);
      const totalAdvances = userAdvances.reduce((s: number, a: any) => s + (a.amount || 0), 0);

      const bonus = tpl.bonus || 0;
      const netSalary = baseSalary + totalAllowance + totalCommission + overtimePay + bonus - totalDeduction - totalAdvances;

      results.push({
        payroll_period_id: period_id,
        tenant_id,
        user_id: profile.id,
        base_salary: Math.round(baseSalary),
        total_allowance: Math.round(totalAllowance),
        total_deduction: Math.round(totalDeduction + totalAdvances),
        total_commission: Math.round(totalCommission),
        bonus: Math.round(bonus + overtimePay),
        net_salary: Math.round(netSalary),
        work_days: workDays,
        work_hours: Math.round(totalMinutes / 60 * 10) / 10,
        late_count: lateCount,
        overtime_hours: Math.round(overtimeMinutes / 60 * 10) / 10,
        status: "draft",
        allowance_details: allowances,
        deduction_details: { ...deductions, advances: totalAdvances },
      });
    }

    // Upsert payroll records
    if (results.length > 0) {
      const { error: insertErr } = await supabase
        .from("payroll_records")
        .upsert(results, { onConflict: "payroll_period_id,user_id" });
      if (insertErr) throw insertErr;
    }

    // Update period status
    await supabase
      .from("payroll_periods")
      .update({ status: "calculated" })
      .eq("id", period_id);

    return new Response(
      JSON.stringify({ success: true, count: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
