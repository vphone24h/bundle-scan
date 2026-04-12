import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function throwIfQueryError(label: string, result: { error: any }) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message || "Unknown error"}`);
  }
}

async function persistPayrollResults(supabase: any, periodId: string, tenantId: string, results: any[]) {
  const { error: upsertErr } = await supabase
    .from("payroll_records")
    .upsert(results, { onConflict: "payroll_period_id,user_id" });

  if (!upsertErr) return;

  const conflictMissing = upsertErr.code === "42P10"
    || String(upsertErr.message || "").includes("no unique or exclusion constraint matching the ON CONFLICT specification");

  if (!conflictMissing) throw upsertErr;

  const { error: deleteErr } = await supabase
    .from("payroll_records")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("payroll_period_id", periodId);
  if (deleteErr) throw deleteErr;

  const { error: insertErr } = await supabase
    .from("payroll_records")
    .insert(results);
  if (insertErr) throw insertErr;
}

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

    // Parallel fetch all needed data
    const [
      platformUsersRes,
      rolesRes,
      empConfigsRes,
      templatesRes,
      attendanceRes,
      advancesRes,
      shiftAssignmentsRes,
      absenceReviewsRes,
      overtimeRequestsRes,
      salesRes,
      salesItemsRes,
    ] = await Promise.all([
      supabase.from("platform_users").select("user_id, email, display_name").eq("tenant_id", tenant_id),
      supabase.from("user_roles").select("user_id, user_role, branch_id, tenant_id").eq("tenant_id", tenant_id),
      supabase.from("employee_salary_configs").select("*, salary_templates(*)").eq("tenant_id", tenant_id),
      supabase.from("salary_templates").select("*").eq("tenant_id", tenant_id).eq("is_active", true),
      supabase.from("attendance_records")
        .select("*, work_shifts(name, start_time, end_time, break_minutes)")
        .eq("tenant_id", tenant_id)
        .gte("date", period.start_date)
        .lte("date", period.end_date),
      supabase.from("salary_advances").select("*").eq("tenant_id", tenant_id).eq("payroll_period_id", period_id).in("status", ["approved", "paid"]),
      supabase.from("shift_assignments").select("*, work_shifts(name, start_time, end_time)").eq("tenant_id", tenant_id).eq("is_active", true),
      supabase.from("absence_reviews").select("*").eq("tenant_id", tenant_id).gte("absence_date", period.start_date).lte("absence_date", period.end_date),
      supabase.from("overtime_requests").select("*").eq("tenant_id", tenant_id).eq("status", "approved").gte("request_date", period.start_date).lte("request_date", period.end_date),
      supabase.from("export_receipts")
        .select("id, created_by, sales_staff_id, total_amount, branch_id, status")
        .eq("tenant_id", tenant_id)
        .gte("created_at", period.start_date)
        .lte("created_at", period.end_date + "T23:59:59")
        .in("status", ["completed", "paid"]),
      supabase.from("export_receipt_items")
        .select("receipt_id, product_id, product_name, category_id, sale_price, quantity")
        .eq("status", "active"),
    ]);

    [
      ["platform_users", platformUsersRes],
      ["user_roles", rolesRes],
      ["employee_salary_configs", empConfigsRes],
      ["salary_templates", templatesRes],
      ["attendance_records", attendanceRes],
      ["salary_advances", advancesRes],
      ["shift_assignments", shiftAssignmentsRes],
      ["absence_reviews", absenceReviewsRes],
      ["export_receipts", salesRes],
      ["export_receipt_items", salesItemsRes],
    ].forEach(([label, result]) => throwIfQueryError(label as string, result as { error: any }));

    const scopedUsers = platformUsersRes.data || [];
    const scopedRoles = rolesRes.data || [];
    const scopedUserIds = [...new Set([
      ...scopedUsers.map((item: any) => item.user_id),
      ...scopedRoles.map((item: any) => item.user_id),
    ])];

    if (!scopedUserIds.length) {
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profilesData, error: profilesErr } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone")
      .in("user_id", scopedUserIds);

    if (profilesErr) throw profilesErr;

    const preferredRoles = new Map<string, any>();
    for (const role of scopedRoles) {
      const existing = preferredRoles.get(role.user_id);
      if (!existing || (!existing.tenant_id && role.tenant_id)) {
        preferredRoles.set(role.user_id, role);
      }
    }

    const profileMap = new Map((profilesData || []).map((profile: any) => [profile.user_id, profile]));
    const platformUserMap = new Map(scopedUsers.map((item: any) => [item.user_id, item]));
    const employees = scopedUserIds.map((userId) => {
      const profile = profileMap.get(userId);
      const role = preferredRoles.get(userId);
      const platformUser = platformUserMap.get(userId);

      return {
        user_id: userId,
        display_name: profile?.display_name || platformUser?.display_name || platformUser?.email || userId.slice(0, 8),
        branch_id: role?.branch_id || null,
      };
    });

    const attendance = attendanceRes.data || [];
    const advances = advancesRes.data || [];
    const shiftAssignments = shiftAssignmentsRes.data || [];
    const absenceReviews = absenceReviewsRes.data || [];
    const allSales = salesRes.data || [];
    const allSaleItems = salesItemsRes.data || [];

    // Map sale items by receipt_id
    const saleItemsByReceipt = groupBy(allSaleItems, "receipt_id");

    // Get template sub-configs including overtimes
    const templateIds = (templatesRes.data || []).map((t: any) => t.id);
    const [bonusRes, commRes, allowRes, holidayRes, penaltyRes, overtimeRes] = templateIds.length
      ? await Promise.all([
          supabase.from("salary_template_bonuses").select("*").in("template_id", templateIds),
          supabase.from("salary_template_commissions").select("*").in("template_id", templateIds),
          supabase.from("salary_template_allowances").select("*").in("template_id", templateIds),
          supabase.from("salary_template_holidays").select("*").in("template_id", templateIds),
          supabase.from("salary_template_penalties").select("*").in("template_id", templateIds),
          supabase.from("salary_template_overtimes").select("*").in("template_id", templateIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

    [
      ["salary_template_bonuses", bonusRes],
      ["salary_template_commissions", commRes],
      ["salary_template_allowances", allowRes],
      ["salary_template_holidays", holidayRes],
      ["salary_template_penalties", penaltyRes],
      ["salary_template_overtimes", overtimeRes],
    ].forEach(([label, result]) => throwIfQueryError(label as string, result as { error: any }));

    const bonusesByTemplate = groupBy(bonusRes.data || [], "template_id");
    const commsByTemplate = groupBy(commRes.data || [], "template_id");
    const allowsByTemplate = groupBy(allowRes.data || [], "template_id");
    const holidaysByTemplate = groupBy(holidayRes.data || [], "template_id");
    const penaltiesByTemplate = groupBy(penaltyRes.data || [], "template_id");
    const overtimesByTemplate = groupBy(overtimeRes.data || [], "template_id");

    // Build employee -> template map
    const empTemplateMap = new Map<string, any>();
    const empConfigMap = new Map<string, any>();
    for (const ec of (empConfigsRes.data || [])) {
      if (ec.salary_templates) {
        empTemplateMap.set(ec.user_id, ec.salary_templates);
        empConfigMap.set(ec.user_id, ec);
      }
    }

    // Calculate expected work days per user from shift_assignments
    function getExpectedWorkDays(userId: string): number {
      const userAssignments = shiftAssignments.filter((sa: any) => sa.user_id === userId);
      if (!userAssignments.length) return 0;
      const startDate = new Date(period.start_date);
      const endDate = new Date(period.end_date);
      let expectedDays = 0;
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        const dayOfWeek = d.getDay();
        for (const sa of userAssignments) {
          if (sa.assignment_type === "fixed" && sa.day_of_week === dayOfWeek) { expectedDays++; break; }
          if (sa.specific_date === dateStr) { expectedDays++; break; }
        }
      }
      return expectedDays;
    }

    const results: any[] = [];

    for (const employee of employees) {
      const template = empTemplateMap.get(employee.user_id);
      const empConfig = empConfigMap.get(employee.user_id);
      const templateId = template?.id || null;
      const baseAmount = empConfig?.custom_base_amount || template?.base_amount || 0;

      // ===== ATTENDANCE DATA =====
      const userAttendance = attendance.filter((a: any) => a.user_id === employee.user_id);
      const workDays = userAttendance.filter((a: any) => a.check_in_time && a.status !== "absent").length;
      const totalMinutes = userAttendance.reduce((s: number, a: any) => s + (a.total_work_minutes || 0), 0);
      const lateRecords = userAttendance.filter((a: any) => a.status === "late" || (a.late_minutes && a.late_minutes > 0));
      const lateCount = lateRecords.length;
      const lateMinutesTotal = userAttendance.reduce((s: number, a: any) => s + (a.late_minutes || 0), 0);
      const earlyLeaveRecords = userAttendance.filter((a: any) => (a.early_leave_minutes || 0) > 0);
      const earlyLeaveCount = earlyLeaveRecords.length;
      const earlyLeaveMinutesTotal = userAttendance.reduce((s: number, a: any) => s + (a.early_leave_minutes || 0), 0);
      const absentCount = userAttendance.filter((a: any) => a.status === "absent").length;
      const overtimeMinutes = userAttendance.reduce((s: number, a: any) => s + (a.overtime_minutes || 0), 0);
      const overtimeHours = Math.round(overtimeMinutes / 60 * 10) / 10;
      const expectedWorkDays = getExpectedWorkDays(employee.user_id);

      // Build absence review map for this user
      const userAbsenceReviews = absenceReviews.filter((r: any) => r.user_id === employee.user_id);
      const absenceReviewMap = new Map(userAbsenceReviews.map((r: any) => [r.absence_date, r]));
      
      // Paid leave days from template
      const paidLeaveDaysPerMonth = template?.paid_leave_days_per_month || 0;

      // Days with overtime (full-day OT = worked on unscheduled day)
      const scheduledDates = new Set<string>();
      const userAssignments = shiftAssignments.filter((sa: any) => sa.user_id === employee.user_id);
      const hasSchedule = userAssignments.length > 0;
      const hasSalaryTemplate = !!templateId;
      const isPayrollReady = hasSchedule && hasSalaryTemplate;
      const missingSetupReasons = [
        ...(!hasSchedule ? ["missing_schedule"] : []),
        ...(!hasSalaryTemplate ? ["missing_salary_template"] : []),
      ];

      for (let d = new Date(period.start_date); d <= new Date(period.end_date); d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        const dow = d.getDay();
        for (const sa of userAssignments) {
          if ((sa.assignment_type === "fixed" && sa.day_of_week === dow) || sa.specific_date === dateStr) {
            scheduledDates.add(dateStr);
            break;
          }
        }
      }
      const fullDayOTCount = userAttendance.filter((a: any) =>
        a.check_in_time && a.status !== "absent" && !scheduledDates.has(a.date)
      ).length;

      // Build day-by-day attendance details
      const attendanceDetails = userAttendance.map((a: any) => {
        const ws = a.work_shifts as any;
        return {
          date: a.date,
          shift_name: ws?.name || null,
          shift_start: ws?.start_time || null,
          shift_end: ws?.end_time || null,
          check_in: a.check_in_time,
          check_out: a.check_out_time,
          status: a.status,
          late_minutes: a.late_minutes || 0,
          early_leave_minutes: a.early_leave_minutes || 0,
          overtime_minutes: a.overtime_minutes || 0,
          total_work_minutes: a.total_work_minutes || 0,
          is_auto_checkout: a.is_auto_checkout || false,
          check_in_method: a.check_in_method,
          note: a.note,
        };
      }).sort((a: any, b: any) => a.date.localeCompare(b.date));

      // ===== SALES DATA =====
      const userSales = allSales.filter((s: any) => (s.sales_staff_id || s.created_by) === employee.user_id);
      const userRevenue = userSales.reduce((s: number, r: any) => s + (r.total_amount || 0), 0);
      const userSaleIds = new Set(userSales.map((s: any) => s.id));

      // Aggregate sold items by product & category
      const soldByProduct = new Map<string, { name: string; qty: number; revenue: number }>();
      const soldByCategory = new Map<string, { qty: number; revenue: number }>();
      for (const sale of userSales) {
        const items = saleItemsByReceipt[sale.id] || [];
        for (const item of items) {
          const lineTotal = (item.sale_price || 0) * (item.quantity || 1);
          // By product
          const pKey = item.product_id || item.product_name;
          const existing = soldByProduct.get(pKey) || { name: item.product_name, qty: 0, revenue: 0 };
          existing.qty += item.quantity || 1;
          existing.revenue += lineTotal;
          soldByProduct.set(pKey, existing);
          // By category
          if (item.category_id) {
            const cExisting = soldByCategory.get(item.category_id) || { qty: 0, revenue: 0 };
            cExisting.qty += item.quantity || 1;
            cExisting.revenue += lineTotal;
            soldByCategory.set(item.category_id, cExisting);
          }
        }
      }

      // Branch revenue (for branch KPI)
      const userBranchId = employee.branch_id;
      const branchSales = userBranchId
        ? allSales.filter((s: any) => s.branch_id === userBranchId)
        : [];
      const branchRevenue = branchSales.reduce((s: number, r: any) => s + (r.total_amount || 0), 0);

      // ===== 1. BASE SALARY =====
      let baseSalary = 0;
      const salaryType = template?.salary_type || "fixed";
      if (!isPayrollReady) {
        baseSalary = 0;
      } else if (salaryType === "fixed") {
        baseSalary = baseAmount;
      } else if (salaryType === "daily") {
        baseSalary = baseAmount * workDays;
      } else if (salaryType === "hourly") {
        baseSalary = baseAmount * (totalMinutes / 60);
      } else if (salaryType === "shift") {
        const shiftDays = userAttendance.filter((a: any) => a.check_in_time && a.shift_id && a.status !== "absent").length;
        baseSalary = baseAmount * shiftDays;
      }

      // ===== 2. BONUS (with real sales data) =====
      let totalBonus = 0;
      const bonusDetails: any[] = [];
      if (isPayrollReady && template?.bonus_enabled) {
        const tBonuses = bonusesByTemplate[templateId] || [];
        for (const b of tBonuses) {
          let amount = 0;
          if (b.bonus_type === "fixed") {
            amount = b.calc_type === "percentage" ? baseSalary * b.value / 100 : b.value;
          } else if (b.bonus_type === "overtime") {
            amount = b.calc_type === "percentage"
              ? (baseSalary / (expectedWorkDays || 22) / 8) * overtimeHours * b.value / 100
              : b.value * overtimeHours;
          } else if (b.bonus_type === "kpi_personal") {
            // KPI cá nhân: so sánh doanh thu cá nhân với ngưỡng
            const threshold = b.threshold || 0;
            if (userRevenue >= threshold && threshold > 0) {
              amount = b.calc_type === "percentage" ? userRevenue * b.value / 100 : b.value;
            }
          } else if (b.bonus_type === "kpi_branch") {
            // KPI chi nhánh: so sánh doanh thu chi nhánh với ngưỡng
            const threshold = b.threshold || 0;
            if (branchRevenue >= threshold && threshold > 0) {
              amount = b.calc_type === "percentage" ? branchRevenue * b.value / 100 : b.value;
            }
          } else if (b.bonus_type === "gross_profit") {
            // Placeholder - needs import price data for profit calc
            amount = 0;
          }
          if (amount > 0) {
            totalBonus += amount;
            bonusDetails.push({
              name: b.name,
              type: b.bonus_type,
              amount: Math.round(amount),
              revenue: b.bonus_type === "kpi_personal" ? userRevenue : b.bonus_type === "kpi_branch" ? branchRevenue : undefined,
              threshold: b.threshold || undefined,
            });
          }
        }
      }

      // ===== 3. COMMISSION (from actual sales) =====
      let totalCommission = 0;
      const commissionDetails: any[] = [];
      if (isPayrollReady && template?.commission_enabled) {
        const tComms = commsByTemplate[templateId] || [];
        // Priority: product > category > general revenue
        const processedProducts = new Set<string>();

        for (const c of tComms) {
          if (c.target_type === "product" && c.target_id) {
            // Commission per specific product
            const sold = soldByProduct.get(c.target_id);
            if (sold && sold.revenue > 0) {
              const amount = c.calc_type === "percentage"
                ? sold.revenue * c.value / 100
                : c.value * sold.qty;
              if (amount > 0) {
                totalCommission += amount;
                commissionDetails.push({
                  name: c.target_name || sold.name,
                  target_type: "product",
                  qty: sold.qty,
                  revenue: sold.revenue,
                  rate: c.value,
                  calc_type: c.calc_type,
                  amount: Math.round(amount),
                });
                processedProducts.add(c.target_id);
              }
            }
          } else if (c.target_type === "category" && c.target_id) {
            // Commission per category (excluding already-processed products)
            const catSold = soldByCategory.get(c.target_id);
            if (catSold && catSold.revenue > 0) {
              const amount = c.calc_type === "percentage"
                ? catSold.revenue * c.value / 100
                : c.value * catSold.qty;
              if (amount > 0) {
                totalCommission += amount;
                commissionDetails.push({
                  name: c.target_name || "Danh mục",
                  target_type: "category",
                  qty: catSold.qty,
                  revenue: catSold.revenue,
                  rate: c.value,
                  calc_type: c.calc_type,
                  amount: Math.round(amount),
                });
              }
            }
          } else if (c.target_type === "revenue") {
            // General revenue commission
            if (userRevenue > 0) {
              const amount = c.calc_type === "percentage"
                ? userRevenue * c.value / 100
                : c.value;
              if (amount > 0) {
                totalCommission += amount;
                commissionDetails.push({
                  name: c.target_name || "Doanh thu",
                  target_type: "revenue",
                  revenue: userRevenue,
                  rate: c.value,
                  calc_type: c.calc_type,
                  amount: Math.round(amount),
                });
              }
            }
          }
        }
      }

      // ===== 4. ALLOWANCE =====
      let totalAllowance = 0;
      const allowanceDetailsV2: any[] = [];
      if (isPayrollReady && template?.allowance_enabled) {
        const tAllows = allowsByTemplate[templateId] || [];
        for (const a of tAllows) {
          let amount = 0;
          if (a.is_fixed) {
            amount = a.amount;
          } else {
            // Per-day allowance (e.g., meal per working day)
            amount = a.amount * workDays;
          }
          if (amount > 0) {
            totalAllowance += amount;
            allowanceDetailsV2.push({
              name: a.name,
              amount: Math.round(amount),
              type: a.is_fixed ? "fixed" : "per_day",
              days: a.is_fixed ? null : workDays,
            });
          }
        }
      }

      // ===== 5. HOLIDAY BONUS =====
      let holidayBonus = 0;
      const holidayDetails: any[] = [];
      if (isPayrollReady && template?.holiday_enabled) {
        const tHolidays = holidaysByTemplate[templateId] || [];
        for (const h of tHolidays) {
          const holidayDates = userAttendance.filter((a: any) => {
            const mmdd = a.date.slice(5);
            return mmdd === h.holiday_date;
          });
          if (holidayDates.length > 0) {
            const dailyRate = salaryType === "fixed"
              ? (baseSalary / (expectedWorkDays || 22))
              : baseAmount;
            const extra = dailyRate * (h.multiplier_percent / 100 - 1) * holidayDates.length;
            holidayBonus += extra;
            holidayDetails.push({
              holiday: h.holiday_name,
              date: h.holiday_date,
              days: holidayDates.length,
              multiplier: h.multiplier_percent,
              extra: Math.round(extra),
            });
          }
        }
      }

      // ===== 6. PENALTY (synced with attendance, threshold-based) =====
      let totalPenalty = 0;
      const penaltyDetails: any[] = [];
      // Track full-day absence days from penalty thresholds (to deduct from work days)
      let penaltyFullDayAbsenceDays = 0;
      if (isPayrollReady && template?.penalty_enabled) {
        const tPenalties = penaltiesByTemplate[templateId] || [];
        for (const p of tPenalties) {
          let count = 0;
          let fullDayCount = 0;
          let detail = "";
          const thresholdMin = p.threshold_minutes || 0;
          const fullDayMin = p.full_day_absence_minutes || 0;

          if (p.penalty_type === "late") {
            // Count late records that exceed the threshold
            for (const a of userAttendance) {
              const mins = a.late_minutes || 0;
              if (mins <= 0) continue;
              if (fullDayMin > 0 && mins >= fullDayMin) {
                fullDayCount++;
              } else if (mins >= thresholdMin) {
                count++;
              }
            }
            detail = `${lateMinutesTotal} phút trễ (${count} lần phạt${fullDayCount > 0 ? `, ${fullDayCount} ngày tính nghỉ` : ''})`;
          } else if (p.penalty_type === "early_leave") {
            for (const a of userAttendance) {
              const mins = a.early_leave_minutes || 0;
              if (mins <= 0) continue;
              if (fullDayMin > 0 && mins >= fullDayMin) {
                fullDayCount++;
              } else if (mins >= thresholdMin) {
                count++;
              }
            }
            detail = `${earlyLeaveMinutesTotal} phút về sớm (${count} lần phạt${fullDayCount > 0 ? `, ${fullDayCount} ngày tính nghỉ` : ''})`;
          } else if (p.penalty_type === "absent_no_permission") {
            // Count absent days: check absence_reviews
            // - If reviewed as excused (is_excused=true) → no penalty
            // - If reviewed as unexcused (is_excused=false) → penalty + deduct salary
            // - If not reviewed → default to penalty (unexcused)
            // Also consider paid leave days: scheduled off days don't count
            const absentDays = userAttendance.filter((a: any) => a.status === "absent");
            let unexcusedCount = 0;
            let excusedCount = 0;
            for (const a of absentDays) {
              const review = absenceReviewMap.get(a.date);
              if (review && review.is_excused) {
                excusedCount++;
              } else {
                unexcusedCount++;
              }
            }

            // Also find scheduled days with NO attendance record (no-show)
            for (const dateStr of scheduledDates) {
              const hasRecord = userAttendance.some((a: any) => a.date === dateStr);
              if (hasRecord) continue;
              // Check if this is a past date
              const dateObj = new Date(dateStr);
              const today = new Date();
              today.setHours(23, 59, 59, 999);
              if (dateObj > today) continue;
              
              const review = absenceReviewMap.get(dateStr);
              if (review && review.is_excused) {
                excusedCount++;
              } else {
                unexcusedCount++;
              }
            }

            // Deduct paid leave days from unexcused (if they have paid leave quota)
            const effectiveUnexcused = Math.max(0, unexcusedCount - Math.max(0, paidLeaveDaysPerMonth - excusedCount));
            count = effectiveUnexcused;
            
            // For fixed salary: deduct 1 day salary per unexcused absence
            if (count > 0 && salaryType === "fixed" && baseSalary > 0) {
              const dailyRate = baseAmount / (expectedWorkDays || 22);
              const absenceDeduction = Math.round(dailyRate * count);
              penaltyFullDayAbsenceDays += count;
              totalPenalty += absenceDeduction;
              penaltyDetails.push({
                name: "Trừ lương nghỉ không phép",
                type: "absent_salary_deduction",
                count,
                per_amount: Math.round(dailyRate),
                amount: absenceDeduction,
                detail: `${count} ngày nghỉ không phép x ${Math.round(dailyRate)}đ/ngày`,
              });
            }
            
            detail = `${absentCount} ngày vắng (${excusedCount} có phép, ${unexcusedCount} không phép)`;
            // For the penalty amount (p.amount per violation), only apply to unexcused
            count = effectiveUnexcused;
          } else if (p.penalty_type === "violation") {
            count = 0; // manual
          }

          penaltyFullDayAbsenceDays += fullDayCount;
          const amount = p.amount * count;
          if (amount > 0 || fullDayCount > 0) {
            totalPenalty += amount;
            penaltyDetails.push({
              name: p.name,
              type: p.penalty_type,
              count,
              per_amount: p.amount,
              amount: Math.round(amount),
              detail,
              full_day_absence_count: fullDayCount,
              threshold_minutes: thresholdMin,
              full_day_absence_minutes: fullDayMin,
            });
          }
        }

        // Deduct full-day absences from base salary for daily/shift/fixed types
        if (penaltyFullDayAbsenceDays > 0 && baseSalary > 0) {
          const dailyRate = salaryType === "fixed"
            ? (baseAmount / (expectedWorkDays || 22))
            : baseAmount;
          const deduction = Math.round(dailyRate * penaltyFullDayAbsenceDays);
          totalPenalty += deduction;
          penaltyDetails.push({
            name: "Trừ công nghỉ (trễ/sớm quá giới hạn)",
            type: "full_day_deduction",
            count: penaltyFullDayAbsenceDays,
            per_amount: Math.round(dailyRate),
            amount: deduction,
            detail: `${penaltyFullDayAbsenceDays} ngày x ${Math.round(dailyRate)}đ`,
          });
        }
      }

      // ===== 7. OVERTIME PAY (from template config) =====
      let overtimePay = 0;
      const overtimeDetails: any[] = [];
      const tOvertimes = overtimesByTemplate[templateId] || [];
      if (isPayrollReady && tOvertimes.length > 0) {
        const dailyRate = salaryType === "fixed"
          ? baseAmount / (expectedWorkDays || 22)
          : baseAmount;
        const hourlyRate = dailyRate / 8;

        for (const ot of tOvertimes) {
          if (ot.overtime_type === "full_day" && fullDayOTCount > 0) {
            // Full-day OT: multiplier % of daily rate per OT day
            const amount = ot.calc_type === "percentage"
              ? dailyRate * ot.value / 100 * fullDayOTCount
              : ot.value * fullDayOTCount;
            overtimePay += amount;
            overtimeDetails.push({
              name: ot.name,
              type: "full_day",
              count: fullDayOTCount,
              amount: Math.round(amount),
            });
          } else if (ot.overtime_type === "hourly" && overtimeHours > 0) {
            // Hourly OT: fixed amount per OT hour or % of hourly rate
            const amount = ot.calc_type === "percentage"
              ? hourlyRate * ot.value / 100 * overtimeHours
              : ot.value * overtimeHours;
            overtimePay += amount;
            overtimeDetails.push({
              name: ot.name,
              type: "hourly",
              hours: overtimeHours,
              amount: Math.round(amount),
            });
          }
        }
      } else if (isPayrollReady) {
        // Fallback: 150% OT rate if no config
        if (overtimeHours > 0) {
          const dailyRateForOT = salaryType === "fixed"
            ? baseAmount / (expectedWorkDays || 22) / 8
            : baseAmount / 8;
          overtimePay = Math.round(overtimeHours * dailyRateForOT * 1.5);
          if (overtimePay > 0) {
            overtimeDetails.push({ name: "Tăng ca (mặc định 150%)", type: "hourly", hours: overtimeHours, amount: overtimePay });
          }
        }
      }

      // ===== ADVANCES =====
      const userAdvances = advances.filter((a: any) => a.user_id === employee.user_id);
      const totalAdvances = isPayrollReady
        ? userAdvances.reduce((s: number, a: any) => s + (a.amount || 0), 0)
        : 0;

      const netSalary = baseSalary + totalBonus + totalCommission + totalAllowance + holidayBonus + overtimePay - totalPenalty - totalAdvances;

      results.push({
        payroll_period_id: period_id,
        tenant_id,
        user_id: employee.user_id,
        user_name: employee.display_name || "N/A",
        base_salary: Math.round(baseSalary),
        total_bonus: Math.round(totalBonus),
        total_commission: Math.round(totalCommission),
        total_allowance: Math.round(totalAllowance),
        total_deduction: 0,
        total_penalty: Math.round(totalPenalty),
        holiday_bonus: Math.round(holidayBonus),
        overtime_pay: Math.round(overtimePay),
        advance_deduction: Math.round(totalAdvances),
        net_salary: Math.round(netSalary),
        total_work_days: workDays,
        total_work_hours: Math.round(totalMinutes / 60 * 10) / 10,
        expected_work_days: expectedWorkDays,
        late_count: lateCount,
        late_minutes_total: lateMinutesTotal,
        absent_count: absentCount,
        early_leave_count: earlyLeaveCount,
        early_leave_minutes_total: earlyLeaveMinutesTotal,
        overtime_hours: overtimeHours,
        attendance_details: attendanceDetails,
        bonus_details: bonusDetails,
        commission_details: commissionDetails,
        allowance_details_v2: allowanceDetailsV2,
        holiday_details: holidayDetails,
        penalty_details: penaltyDetails,
        config_snapshot: {
          template_id: templateId,
          template_name: template?.name || null,
          salary_type: salaryType,
          base_amount: baseAmount,
          expected_work_days: expectedWorkDays,
          user_revenue: userRevenue,
          branch_revenue: branchRevenue,
          overtime_details: overtimeDetails,
          sale_count: userSales.length,
          is_payroll_ready: isPayrollReady,
          missing_setup_reasons: missingSetupReasons,
        },
        status: "draft",
      });
    }

    // Upsert
    if (results.length > 0) {
      await persistPayrollResults(supabase, period_id, tenant_id, results);
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
    console.error("Calculate payroll error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || "Tính lương thất bại" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
