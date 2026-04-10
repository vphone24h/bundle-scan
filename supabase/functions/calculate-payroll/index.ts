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
    if (period.status === "finalized") throw new Error("Period already finalized");

    // Get all employees
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, tenant_id")
      .eq("tenant_id", tenant_id);

    if (!profiles?.length) {
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get employee salary configs (links employee to template)
    const { data: empConfigs } = await supabase
      .from("employee_salary_configs")
      .select("*, salary_templates(*)")
      .eq("tenant_id", tenant_id);

    // Get salary templates with sub-configs
    const { data: templates } = await supabase
      .from("salary_templates")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true);

    // Get sub-configs for all templates
    const templateIds = (templates || []).map((t: any) => t.id);
    
    const [bonusRes, commRes, allowRes, holidayRes, penaltyRes] = await Promise.all([
      supabase.from("salary_template_bonuses").select("*").in("template_id", templateIds),
      supabase.from("salary_template_commissions").select("*").in("template_id", templateIds),
      supabase.from("salary_template_allowances").select("*").in("template_id", templateIds),
      supabase.from("salary_template_holidays").select("*").in("template_id", templateIds),
      supabase.from("salary_template_penalties").select("*").in("template_id", templateIds),
    ]);

    const bonusesByTemplate = groupBy(bonusRes.data || [], "template_id");
    const commsByTemplate = groupBy(commRes.data || [], "template_id");
    const allowsByTemplate = groupBy(allowRes.data || [], "template_id");
    const holidaysByTemplate = groupBy(holidayRes.data || [], "template_id");
    const penaltiesByTemplate = groupBy(penaltyRes.data || [], "template_id");

    // Get attendance records for the period
    const { data: attendance } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("tenant_id", tenant_id)
      .gte("date", period.start_date)
      .lte("date", period.end_date);

    // Get salary advances
    const { data: advances } = await supabase
      .from("salary_advances")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("payroll_period_id", period_id)
      .in("status", ["approved", "paid"]);

    // Build employee -> template map
    const empTemplateMap = new Map<string, any>();
    for (const ec of (empConfigs || [])) {
      if (ec.salary_templates) {
        empTemplateMap.set(ec.user_id, ec.salary_templates);
      }
    }

    const results: any[] = [];

    for (const profile of profiles) {
      const template = empTemplateMap.get(profile.id);
      if (!template) continue;

      const templateId = template.id;
      const userAttendance = (attendance || []).filter((a: any) => a.user_id === profile.id);
      const workDays = userAttendance.filter((a: any) => a.check_in_time && a.status !== "absent").length;
      const totalMinutes = userAttendance.reduce((s: number, a: any) => s + (a.total_work_minutes || 0), 0);
      const lateCount = userAttendance.filter((a: any) => a.status === "late").length;
      const earlyLeaveCount = userAttendance.filter((a: any) => (a.early_leave_minutes || 0) > 0).length;
      const absentCount = userAttendance.filter((a: any) => a.status === "absent").length;
      const overtimeMinutes = userAttendance.reduce((s: number, a: any) => s + (a.overtime_minutes || 0), 0);

      // 1. BASE SALARY
      let baseSalary = 0;
      const salaryType = template.salary_type || "fixed";
      if (salaryType === "fixed") {
        baseSalary = template.base_amount || 0;
      } else if (salaryType === "daily") {
        baseSalary = (template.base_amount || 0) * workDays;
      } else if (salaryType === "hourly") {
        baseSalary = (template.base_amount || 0) * (totalMinutes / 60);
      } else if (salaryType === "shift") {
        baseSalary = (template.base_amount || 0) * workDays;
      }

      // 2. BONUS
      let totalBonus = 0;
      const bonusDetails: any[] = [];
      if (template.bonus_enabled) {
        const tBonuses = bonusesByTemplate[templateId] || [];
        for (const b of tBonuses) {
          let amount = 0;
          if (b.bonus_type === "fixed") {
            amount = b.calc_type === "percentage" ? baseSalary * b.value / 100 : b.value;
          } else if (b.bonus_type === "overtime") {
            const otHours = overtimeMinutes / 60;
            amount = b.calc_type === "percentage" 
              ? (baseSalary / 22 / 8) * otHours * b.value / 100
              : b.value * otHours;
          }
          // KPI and branch_revenue would need order data - simplified for now
          totalBonus += amount;
          bonusDetails.push({ name: b.name, type: b.bonus_type, amount: Math.round(amount) });
        }
      }

      // 3. COMMISSION
      let totalCommission = 0;
      const commissionDetails: any[] = [];
      if (template.commission_enabled) {
        // Commission calculation would need order/sales data
        // Placeholder - to be enhanced with actual sales data
        const tComms = commsByTemplate[templateId] || [];
        for (const c of tComms) {
          commissionDetails.push({ target: c.target_name, type: c.calc_type, value: c.value });
        }
      }

      // 4. ALLOWANCE
      let totalAllowance = 0;
      const allowanceDetailsV2: any[] = [];
      if (template.allowance_enabled) {
        const tAllows = allowsByTemplate[templateId] || [];
        for (const a of tAllows) {
          if (a.is_fixed) {
            totalAllowance += a.amount;
            allowanceDetailsV2.push({ name: a.name, amount: a.amount });
          }
        }
      }

      // 5. HOLIDAY BONUS
      let holidayBonus = 0;
      const holidayDetails: any[] = [];
      if (template.holiday_enabled) {
        const tHolidays = holidaysByTemplate[templateId] || [];
        for (const h of tHolidays) {
          // Check if any work days fall on this holiday
          const holidayDates = userAttendance.filter((a: any) => {
            const d = a.date; // YYYY-MM-DD
            const mmdd = d.slice(5); // MM-DD
            return mmdd === h.holiday_date;
          });
          if (holidayDates.length > 0) {
            const dailyRate = salaryType === "fixed" ? (baseSalary / 22) : (template.base_amount || 0);
            const extra = dailyRate * (h.multiplier_percent / 100 - 1) * holidayDates.length;
            holidayBonus += extra;
            holidayDetails.push({ holiday: h.holiday_name, days: holidayDates.length, extra: Math.round(extra) });
          }
        }
      }

      // 6. PENALTY
      let totalPenalty = 0;
      const penaltyDetails: any[] = [];
      if (template.penalty_enabled) {
        const tPenalties = penaltiesByTemplate[templateId] || [];
        for (const p of tPenalties) {
          let count = 0;
          if (p.penalty_type === "late") count = lateCount;
          else if (p.penalty_type === "early_leave") count = earlyLeaveCount;
          else if (p.penalty_type === "absent_no_permission") count = absentCount;
          else if (p.penalty_type === "violation") count = 1; // manual
          
          const amount = p.amount * count;
          if (amount > 0) {
            totalPenalty += amount;
            penaltyDetails.push({ name: p.name, count, amount: Math.round(amount) });
          }
        }
      }

      // ADVANCES
      const userAdvances = (advances || []).filter((a: any) => a.user_id === profile.id);
      const totalAdvances = userAdvances.reduce((s: number, a: any) => s + (a.amount || 0), 0);

      const netSalary = baseSalary + totalBonus + totalCommission + totalAllowance + holidayBonus - totalPenalty - totalAdvances;

      results.push({
        payroll_period_id: period_id,
        tenant_id,
        user_id: profile.id,
        user_name: profile.display_name || "N/A",
        base_salary: Math.round(baseSalary),
        total_bonus: Math.round(totalBonus),
        total_commission: Math.round(totalCommission),
        total_allowance: Math.round(totalAllowance),
        total_deduction: 0,
        total_penalty: Math.round(totalPenalty),
        holiday_bonus: Math.round(holidayBonus),
        overtime_pay: Math.round((overtimeMinutes / 60) * ((template.base_amount || 0) / 22 / 8)),
        advance_deduction: Math.round(totalAdvances),
        net_salary: Math.round(netSalary),
        total_work_days: workDays,
        total_work_hours: Math.round(totalMinutes / 60 * 10) / 10,
        status: "draft",
        bonus_details: bonusDetails,
        commission_details: commissionDetails,
        allowance_details_v2: allowanceDetailsV2,
        holiday_details: holidayDetails,
        penalty_details: penaltyDetails,
        config_snapshot: { template_id: templateId, template_name: template.name },
      });
    }

    // Upsert
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

function groupBy(arr: any[], key: string): Record<string, any[]> {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, any[]>);
}
