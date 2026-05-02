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
    if (period.status === "paid") throw new Error("Period already finalized");

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
      leaveRequestsRes,
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
        .select("id, created_by, sales_staff_id, total_amount, branch_id, status, is_self_sold")
        .eq("tenant_id", tenant_id)
        .gte("created_at", period.start_date)
        .lte("created_at", period.end_date + "T23:59:59")
        .in("status", ["completed", "paid"]),
      supabase.from("leave_requests")
        .select("user_id, leave_date_from, leave_date_to, status, request_type")
        .eq("tenant_id", tenant_id)
        .eq("status", "approved")
        .lte("leave_date_from", period.end_date)
        .gte("leave_date_to", period.start_date),
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
      ["overtime_requests", overtimeRequestsRes],
      ["export_receipts", salesRes],
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
    const approvedOvertimeRequests = overtimeRequestsRes.data || [];
    const allSales = salesRes.data || [];
    const saleReceiptIds = allSales.map((sale: any) => sale.id).filter(Boolean);
    let allSaleItems: any[] = [];
    if (saleReceiptIds.length > 0) {
      const salesItemsResults = await Promise.all(
        chunkArray(saleReceiptIds, 100).map((receiptIds) =>
          supabase
            .from("export_receipt_items")
            .select("receipt_id, product_id, product_name, category_id, sale_price, quantity, imei")
            .in("receipt_id", receiptIds)
            .neq("status", "returned")
        )
      );
      salesItemsResults.forEach((result) => throwIfQueryError("export_receipt_items", result));
      allSaleItems = salesItemsResults.flatMap((result) => result.data || []);
    }
    const approvedLeaveRequests = leaveRequestsRes.data || [];

    // Load paid leave default schedules (lặp hàng tháng) + overrides cho period này
    const periodYear = new Date(period.start_date).getFullYear();
    const periodMonth = new Date(period.start_date).getMonth() + 1;
    const [paidLeaveDefaultsRes, paidLeaveOverridesRes] = await Promise.all([
      supabase.from("paid_leave_default_dates").select("user_id, days_of_month").eq("tenant_id", tenant_id).in("user_id", scopedUserIds),
      supabase.from("paid_leave_overrides").select("user_id, leave_dates").eq("tenant_id", tenant_id).eq("year", periodYear).eq("month", periodMonth).in("user_id", scopedUserIds),
    ]);
    const paidLeaveDefaultMap = new Map<string, number[]>();
    for (const r of (paidLeaveDefaultsRes.data || [])) {
      paidLeaveDefaultMap.set((r as any).user_id, ((r as any).days_of_month as number[]) || []);
    }
    const paidLeaveOverrideMap = new Map<string, string[]>();
    for (const r of (paidLeaveOverridesRes.data || [])) {
      paidLeaveOverrideMap.set((r as any).user_id, ((r as any).leave_dates as string[]) || []);
    }
    /** Trả về Set các ngày (YYYY-MM-DD) là ngày nghỉ có lương cho user trong period */
    function getPaidLeaveDatesForUser(userId: string): Set<string> {
      const set = new Set<string>();
      const override = paidLeaveOverrideMap.get(userId);
      if (override && override.length > 0) {
        for (const d of override) set.add(d);
        return set;
      }
      const defaults = paidLeaveDefaultMap.get(userId) || [];
      if (defaults.length === 0) return set;
      for (let d = new Date(period.start_date); d <= new Date(period.end_date); d.setDate(d.getDate() + 1)) {
        if (defaults.includes(d.getDate())) {
          set.add(d.toISOString().split("T")[0]);
        }
      }
      return set;
    }

    // Load product import_price for gross_profit bonus calculation
    const productIdsInSales = [...new Set(allSaleItems.map((it: any) => it.product_id).filter(Boolean))];
    const productInfoMap = new Map<string, { import_price: number; category_id: string | null }>();
    if (productIdsInSales.length > 0) {
      const { data: prods } = await supabase
        .from("products")
        .select("id, import_price, category_id")
        .in("id", productIdsInSales);
      for (const p of (prods || [])) {
        productInfoMap.set((p as any).id, {
          import_price: Number((p as any).import_price || 0),
          category_id: (p as any).category_id || null,
        });
      }
    }

    // Build per-user maps of dates with approved late_arrival / early_leave waivers
    // Key: user_id + "_" + date(yyyy-MM-dd)
    const approvedLateArrivalKeys = new Set<string>();
    const approvedEarlyLeaveKeys = new Set<string>();
    for (const lr of approvedLeaveRequests) {
      const rType = (lr as any).request_type || 'full_day';
      if (rType !== 'late_arrival' && rType !== 'early_leave') continue;
      // Iterate dates from -> to
      const start = new Date(lr.leave_date_from);
      const end = new Date(lr.leave_date_to);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split("T")[0];
        const key = `${lr.user_id}_${ds}`;
        if (rType === 'late_arrival') approvedLateArrivalKeys.add(key);
        else approvedEarlyLeaveKeys.add(key);
      }
    }

    // Map sale items by receipt_id
    const saleItemsByReceipt = groupBy(allSaleItems, "receipt_id");

    // Load category hierarchy so commission picked at parent category (e.g. "iPhone")
    // also captures sales tagged with leaf categories (e.g. "iPhone 15", "iPhone 15 Pro").
    const { data: categoriesData } = await supabase
      .from("categories")
      .select("id, parent_id, name")
      .eq("tenant_id", tenant_id);
    const categoryParentMap = new Map<string, string | null>();
    const categoryNameMap = new Map<string, string>();
    for (const c of (categoriesData || [])) {
      categoryParentMap.set((c as any).id, (c as any).parent_id || null);
      categoryNameMap.set((c as any).id, String((c as any).name || ""));
    }
    function normalizeText(value: string | null | undefined): string {
      return String(value || "")
        .trim()
        .toLocaleLowerCase("vi-VN")
        .normalize("NFC");
    }
    /** Trả về tất cả id tổ tiên (bao gồm chính nó) của 1 category */
    function getCategoryAncestors(catId: string | null | undefined): string[] {
      if (!catId) return [];
      const out: string[] = [];
      let cur: string | null | undefined = catId;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        out.push(cur);
        cur = categoryParentMap.get(cur) || null;
      }
      return out;
    }

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
      // Approved overtime requests for this user
      // Only process overtime if template has enable_overtime = true
      const enableOvertime = template?.enable_overtime === true;
      const userOTRequests = enableOvertime ? approvedOvertimeRequests.filter((r: any) => r.user_id === employee.user_id) : [];
      const approvedExtraHoursDates = new Set(userOTRequests.filter((r: any) => r.request_type === "extra_hours").map((r: any) => r.request_date));
      const approvedDayOffDates = new Set(userOTRequests.filter((r: any) => r.request_type === "day_off").map((r: any) => r.request_date));
      const approvedEarlyCheckinMap = new Map(userOTRequests.filter((r: any) => r.request_type === "early_checkin").map((r: any) => [r.request_date, r.overtime_minutes || 0]));

      // Only count overtime minutes from approved extra_hours + early_checkin requests
      const approvedOvertimeMinutes = enableOvertime ? userAttendance.reduce((s: number, a: any) => {
        let mins = 0;
        if (approvedExtraHoursDates.has(a.date)) mins += (a.overtime_minutes || 0);
        if (approvedEarlyCheckinMap.has(a.date)) mins += (approvedEarlyCheckinMap.get(a.date) || 0);
        return s + mins;
      }, 0) : 0;
      const overtimeMinutes = approvedOvertimeMinutes;
      const overtimeHours = Math.round(overtimeMinutes / 60 * 10) / 10;
      const expectedWorkDays = getExpectedWorkDays(employee.user_id);

      // Build absence review map for this user
      const userAbsenceReviews = absenceReviews.filter((r: any) => r.user_id === employee.user_id);
      const absenceReviewMap = new Map(userAbsenceReviews.map((r: any) => [r.absence_date, r]));
      
      // Paid leave days from template
      const paidLeaveDaysPerMonth = template?.paid_leave_days_per_month || 0;

      // Days with overtime (full-day OT = worked on unscheduled day, only if approved)
      const scheduledDates = new Set<string>();
      const userAssignments = shiftAssignments.filter((sa: any) => sa.user_id === employee.user_id);
      const hasSchedule = userAssignments.length > 0;
      const hasSalaryTemplate = !!templateId;
      const salaryType = template?.salary_type || "fixed";
      // Schedule requirements per salary type:
      // - shift: ALWAYS requires schedule (to match completed shifts)
      // - fixed/daily/hourly with overtime ON: requires schedule
      // - fixed/daily/hourly with overtime OFF: no schedule needed
      const needsSchedule = salaryType === "shift" || enableOvertime;
      const isPayrollReady = hasSalaryTemplate && (needsSchedule ? hasSchedule : true);
      const missingSetupReasons = [
        ...(needsSchedule && !hasSchedule ? ["missing_schedule"] : []),
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
      // Only count full-day OT if the day-off work was approved
      // Ngày nghỉ có lương cũng được coi như day-off: đi làm phải có duyệt OT mới được tính.
      const paidLeaveDatesSet = getPaidLeaveDatesForUser(employee.user_id);
      const fullDayOTCount = userAttendance.filter((a: any) => {
        if (!a.check_in_time || a.status === "absent") return false;
        const isDayOff = !scheduledDates.has(a.date) || paidLeaveDatesSet.has(a.date);
        return isDayOff && approvedDayOffDates.has(a.date);
      }).length;

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
      let userRevenue = userSales.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
      const selfSoldSet = new Set<string>(userSales.filter((s: any) => s.is_self_sold === true).map((s: any) => s.id));
      const selfRevenueOnly = userSales.filter((s: any) => s.is_self_sold === true).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
      const userSaleIds = new Set(userSales.map((s: any) => s.id));

      // Aggregate sold items by product & category
      const soldByProduct = new Map<string, { name: string; qty: number; revenue: number }>();
      const soldByCategory = new Map<string, { qty: number; revenue: number }>();
      const soldByCategoryName = new Map<string, { qty: number; revenue: number }>();
      // Per-target product breakdown: list each product sold under a category/target
      const productsByCategory = new Map<string, Map<string, { name: string; qty: number; revenue: number }>>();
      const productsByCategoryName = new Map<string, Map<string, { name: string; qty: number; revenue: number }>>();
      // Self-sold-only mirrors (for commission rules with only_self_sold = true)
      const soldByProductSS = new Map<string, { name: string; qty: number; revenue: number }>();
      const soldByCategorySS = new Map<string, { qty: number; revenue: number }>();
      const soldByCategoryNameSS = new Map<string, { qty: number; revenue: number }>();
      const productsByCategorySS = new Map<string, Map<string, { name: string; qty: number; revenue: number }>>();
      const productsByCategoryNameSS = new Map<string, Map<string, { name: string; qty: number; revenue: number }>>();
      let userGrossProfit = 0;
      for (const sale of userSales) {
        const items = saleItemsByReceipt[sale.id] || [];
        const isSS = selfSoldSet.has(sale.id);
        for (const item of items) {
          const quantity = Number(item.quantity ?? 1) || 0;
          const salePrice = Number(item.sale_price || 0);
          const lineTotal = salePrice * quantity;
          // Gross profit = (sale_price - import_price) * quantity
          const productInfo = item.product_id ? productInfoMap.get(item.product_id) : null;
          const importPrice = Number(productInfo?.import_price || 0);
          if (importPrice > 0) {
            userGrossProfit += (salePrice - importPrice) * quantity;
          }
          // By product
          const pKey = item.product_id || item.product_name;
          const existing = soldByProduct.get(pKey) || { name: item.product_name, qty: 0, revenue: 0 };
          existing.qty += quantity;
          existing.revenue += lineTotal;
          soldByProduct.set(pKey, existing);
          if (isSS) {
            const exSS = soldByProductSS.get(pKey) || { name: item.product_name, qty: 0, revenue: 0 };
            exSS.qty += quantity; exSS.revenue += lineTotal;
            soldByProductSS.set(pKey, exSS);
          }
          // By category — propagate to ALL ancestor categories so a commission rule
          // attached to a parent ("iPhone") includes sales of leaf categories ("iPhone 15 Pro", ...)
          const effectiveCategoryId = item.category_id || productInfo?.category_id || null;
          if (effectiveCategoryId) {
            const ancestors = getCategoryAncestors(effectiveCategoryId);
            for (const cid of ancestors) {
              const cExisting = soldByCategory.get(cid) || { qty: 0, revenue: 0 };
              cExisting.qty += quantity;
              cExisting.revenue += lineTotal;
              soldByCategory.set(cid, cExisting);

              // Per-product list for this category
              let prodMap = productsByCategory.get(cid);
              if (!prodMap) { prodMap = new Map(); productsByCategory.set(cid, prodMap); }
              const prodKey = item.product_id || item.product_name;
              const prodEx = prodMap.get(prodKey) || { name: item.product_name, qty: 0, revenue: 0 };
              prodEx.qty += quantity;
              prodEx.revenue += lineTotal;
              prodMap.set(prodKey, prodEx);

              const categoryNameKey = normalizeText(categoryNameMap.get(cid));
              if (categoryNameKey) {
                const byName = soldByCategoryName.get(categoryNameKey) || { qty: 0, revenue: 0 };
                byName.qty += quantity;
                byName.revenue += lineTotal;
                soldByCategoryName.set(categoryNameKey, byName);

                let prodMapN = productsByCategoryName.get(categoryNameKey);
                if (!prodMapN) { prodMapN = new Map(); productsByCategoryName.set(categoryNameKey, prodMapN); }
                const pEx = prodMapN.get(prodKey) || { name: item.product_name, qty: 0, revenue: 0 };
                pEx.qty += quantity;
                pEx.revenue += lineTotal;
                prodMapN.set(prodKey, pEx);
              }
              if (isSS) {
                const cSS = soldByCategorySS.get(cid) || { qty: 0, revenue: 0 };
                cSS.qty += quantity; cSS.revenue += lineTotal;
                soldByCategorySS.set(cid, cSS);
                let pmSS = productsByCategorySS.get(cid);
                if (!pmSS) { pmSS = new Map(); productsByCategorySS.set(cid, pmSS); }
                const peSS = pmSS.get(prodKey) || { name: item.product_name, qty: 0, revenue: 0 };
                peSS.qty += quantity; peSS.revenue += lineTotal;
                pmSS.set(prodKey, peSS);
                if (categoryNameKey) {
                  const cnSS = soldByCategoryNameSS.get(categoryNameKey) || { qty: 0, revenue: 0 };
                  cnSS.qty += quantity; cnSS.revenue += lineTotal;
                  soldByCategoryNameSS.set(categoryNameKey, cnSS);
                  let pmnSS = productsByCategoryNameSS.get(categoryNameKey);
                  if (!pmnSS) { pmnSS = new Map(); productsByCategoryNameSS.set(categoryNameKey, pmnSS); }
                  const peNSS = pmnSS.get(prodKey) || { name: item.product_name, qty: 0, revenue: 0 };
                  peNSS.qty += quantity; peNSS.revenue += lineTotal;
                  pmnSS.set(prodKey, peNSS);
                }
              }
            }
          }
        }
      }

      // Branch revenue (for branch KPI)
      const userBranchId = employee.branch_id;
      const branchSales = userBranchId
        ? allSales.filter((s: any) => s.branch_id === userBranchId)
        : [];
      let branchRevenue = branchSales.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);

      // Nếu có rule hoa hồng "tự bán" yêu cầu KHÔNG cộng doanh số đơn tự bán vào KPI thưởng
      // → trừ doanh thu các đơn tự bán đó khỏi userRevenue/branchRevenue dùng tính KPI.
      const _tCommsForKpi = (commsByTemplate[templateId] || []) as any[];
      const _excludeSelfSoldFromKpi = _tCommsForKpi.some(
        (c: any) => c.only_self_sold === true && c.count_in_revenue_kpi === false
      );
      if (_excludeSelfSoldFromKpi && selfRevenueOnly > 0) {
        userRevenue = Math.max(0, userRevenue - selfRevenueOnly);
        const branchSelfSoldRevenue = branchSales
          .filter((s: any) => s.is_self_sold === true && (s.sales_staff_id || s.created_by) === employee.user_id)
          .reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
        branchRevenue = Math.max(0, branchRevenue - branchSelfSoldRevenue);
      }

      // Branch-wide product breakdown + branch gross profit (for branch_revenue popup)
      const soldByBranchProduct = new Map<string, { name: string; qty: number; revenue: number }>();
      for (const sale of branchSales) {
        const items = saleItemsByReceipt[sale.id] || [];
        for (const item of items) {
          const quantity = Number(item.quantity ?? 1) || 0;
          const salePrice = Number(item.sale_price || 0);
          const lineTotal = salePrice * quantity;
          const pKey = item.product_id || item.product_name;
          const ex = soldByBranchProduct.get(pKey) || { name: item.product_name, qty: 0, revenue: 0 };
          ex.qty += quantity;
          ex.revenue += lineTotal;
          soldByBranchProduct.set(pKey, ex);
        }
      }

      // ===== 1. BASE SALARY =====
      let baseSalary = 0;
      if (!isPayrollReady) {
        baseSalary = 0;
      } else if (salaryType === "fixed") {
        // Prorate theo ngày công + ngày phép có lương đã dùng
        // Công thức: base × (ngày công thực + min(quota phép, ngày vắng)) / ngày công chuẩn
        const expected = expectedWorkDays || 22;
        // Đếm số ngày vắng (gồm absent có record + scheduled days không có record)
        const absentRecorded = userAttendance.filter((a: any) => a.status === "absent").length;
        let absentNoShow = 0;
        for (const dateStr of scheduledDates) {
          const hasRecord = userAttendance.some((a: any) => a.date === dateStr);
          if (hasRecord) continue;
          const dateObj = new Date(dateStr);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          if (dateObj > today) continue;
          absentNoShow++;
        }
        const totalAbsent = absentRecorded + absentNoShow;
        const paidLeaveUsed = Math.min(paidLeaveDaysPerMonth, totalAbsent);
        const paidWorkDays = workDays + paidLeaveUsed;
        const ratio = Math.min(1, paidWorkDays / expected);
        baseSalary = Math.round(baseAmount * ratio);
      } else if (salaryType === "daily") {
        // Lương theo ngày: base_amount = lương/ngày × số ngày có mặt
        baseSalary = baseAmount * workDays;
      } else if (salaryType === "hourly") {
        baseSalary = baseAmount * (totalMinutes / 60);
      } else if (salaryType === "shift") {
        // Lương theo ca: chỉ tính ca hoàn thành (có check-in + check-out + shift_id)
        const completedShifts = userAttendance.filter((a: any) =>
          a.check_in_time && a.check_out_time && a.shift_id && a.status !== "absent"
        ).length;
        baseSalary = baseAmount * completedShifts;
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
            // KPI cá nhân: so sánh doanh thu cá nhân với ngưỡng (threshold = mức đạt KPI 100%)
            // QUY TẮC CỘNG DỒN:
            //  - Khi đạt KPI (userRevenue >= threshold): nhận thưởng cơ bản (baseAmt).
            //  - Khi vượt thêm theo từng mức tier: cộng thêm "Thưởng thêm" của mức cao nhất NV đạt.
            //  - Tier có "Vượt KPI (%)" = % VƯỢT THÊM so với threshold (VD threshold=50tr,
            //    "Vượt 100%" nghĩa là đạt 100tr — tức vượt thêm 50tr = 100% của KPI).
            //  → Tổng = baseAmt + tier cao nhất matched (cộng dồn, KHÔNG thay thế).
            const threshold = b.threshold || 0;
            const baseAmt = (threshold > 0 && userRevenue >= threshold)
              ? (b.calc_type === "percentage" ? userRevenue * b.value / 100 : b.value)
              : 0;

            let tierAmt = 0;
            let matchedTier: any = null;
            const tiers = Array.isArray(b.tiers) ? b.tiers : [];
            if (tiers.length > 0 && threshold > 0 && userRevenue >= threshold) {
              const overPercent = ((userRevenue - threshold) / threshold) * 100;
              const sortedTiers = [...tiers].sort((a: any, b2: any) => Number(b2.percent_over) - Number(a.percent_over));
              const matched = sortedTiers.find((t: any) => overPercent >= Number(t.percent_over || 0));
              if (matched) {
                matchedTier = matched;
                tierAmt = matched.calc_type === "percentage"
                  ? userRevenue * Number(matched.value || 0) / 100
                  : Number(matched.value || 0);
              }
            }
            amount = baseAmt + tierAmt;
            (b as any)._breakdown = { baseAmt: Math.round(baseAmt), tierAmt: Math.round(tierAmt), matchedTier, baseValue: b.value, baseCalcType: b.calc_type };
          } else if (b.bonus_type === "kpi_branch" || b.bonus_type === "branch_revenue") {
            // KPI chi nhánh: so sánh doanh thu chi nhánh (theo branch của NV) với ngưỡng
            // CỘNG DỒN: thưởng cơ bản + tier vượt cao nhất (giống kpi_personal)
            const threshold = b.threshold || 0;
            const baseAmt = (threshold > 0 && branchRevenue >= threshold)
              ? (b.calc_type === "percentage" ? branchRevenue * b.value / 100 : b.value)
              : 0;
            let tierAmt = 0;
            let matchedTier: any = null;
            const tiers = Array.isArray(b.tiers) ? b.tiers : [];
            if (tiers.length > 0 && threshold > 0 && branchRevenue >= threshold) {
              const overPercent = ((branchRevenue - threshold) / threshold) * 100;
              const sortedTiers = [...tiers].sort((a: any, b2: any) => Number(b2.percent_over) - Number(a.percent_over));
              const matched = sortedTiers.find((t: any) => overPercent >= Number(t.percent_over || 0));
              if (matched) {
                matchedTier = matched;
                tierAmt = matched.calc_type === "percentage"
                  ? branchRevenue * Number(matched.value || 0) / 100
                  : Number(matched.value || 0);
              }
            }
            amount = baseAmt + tierAmt;
            (b as any)._breakdown = { baseAmt: Math.round(baseAmt), tierAmt: Math.round(tierAmt), matchedTier, baseValue: b.value, baseCalcType: b.calc_type };
          } else if (b.bonus_type === "gross_profit") {
            // Lợi nhuận gộp cá nhân: (giá bán - giá nhập) × SL của các đơn NV bán
            // CỘNG DỒN: thưởng cơ bản + tier vượt cao nhất
            const threshold = b.threshold || 0;
            const baseAmt = (threshold > 0 && userGrossProfit >= threshold)
              ? (b.calc_type === "percentage" ? userGrossProfit * b.value / 100 : b.value)
              : 0;
            let tierAmt = 0;
            let matchedTier: any = null;
            const tiers = Array.isArray(b.tiers) ? b.tiers : [];
            if (tiers.length > 0 && threshold > 0 && userGrossProfit >= threshold) {
              const overPercent = ((userGrossProfit - threshold) / threshold) * 100;
              const sortedTiers = [...tiers].sort((a: any, b2: any) => Number(b2.percent_over) - Number(a.percent_over));
              const matched = sortedTiers.find((t: any) => overPercent >= Number(t.percent_over || 0));
              if (matched) {
                matchedTier = matched;
                tierAmt = matched.calc_type === "percentage"
                  ? userGrossProfit * Number(matched.value || 0) / 100
                  : Number(matched.value || 0);
              }
            }
            amount = baseAmt + tierAmt;
            (b as any)._breakdown = { baseAmt: Math.round(baseAmt), tierAmt: Math.round(tierAmt), matchedTier, baseValue: b.value, baseCalcType: b.calc_type };
          }
          if (amount > 0) {
            totalBonus += amount;
            const bd = (b as any)._breakdown || null;
            // For revenue-based bonuses, attach product list for popup detail
            let bonusProducts: any[] = [];
            if (b.bonus_type === "kpi_personal" || b.bonus_type === "gross_profit") {
              bonusProducts = Array.from(soldByProduct.values())
                .sort((a, b2) => b2.revenue - a.revenue)
                .map(p => ({ name: p.name, qty: p.qty, revenue: p.revenue }));
            } else if (b.bonus_type === "kpi_branch" || b.bonus_type === "branch_revenue") {
              // Branch revenue: list products sold by employee's branch
              bonusProducts = Array.from(soldByBranchProduct.values())
                .sort((a: any, b2: any) => b2.revenue - a.revenue)
                .map((p: any) => ({ name: p.name, qty: p.qty, revenue: p.revenue }));
            }
            bonusDetails.push({
              name: b.name,
              type: b.bonus_type,
              amount: Math.round(amount),
              revenue: b.bonus_type === "kpi_personal" ? userRevenue : (b.bonus_type === "kpi_branch" || b.bonus_type === "branch_revenue") ? branchRevenue : b.bonus_type === "gross_profit" ? userGrossProfit : undefined,
              threshold: b.threshold || undefined,
              calc_type: b.calc_type,
              value: b.value,
              base_amount: bd?.baseAmt,
              tier_amount: bd?.tierAmt,
              matched_tier: bd?.matchedTier ? {
                percent_over: Number(bd.matchedTier.percent_over || 0),
                calc_type: bd.matchedTier.calc_type,
                value: Number(bd.matchedTier.value || 0),
              } : null,
              products: bonusProducts,
            });
          }
        }
      }

      // ===== 3. COMMISSION (from actual sales) =====
      let totalCommission = 0;
      const commissionDetails: any[] = [];
      const tComms = commsByTemplate[templateId] || [];
      const runtimeCommissionEnabled = tComms.length > 0 || template?.commission_enabled === true;
      if (isPayrollReady && runtimeCommissionEnabled) {
        // Priority: product > category > general revenue
        const processedProducts = new Set<string>();

        for (const c of tComms) {
          const onlySS = c.only_self_sold === true;
          // Khi rule "Chỉ đơn của nhân viên" mà admin TẮT toggle "Tính doanh số/hoa hồng đơn tự bán"
          // → bỏ qua hoàn toàn rule này (không tính hoa hồng, không cộng KPI).
          if (onlySS && c.count_in_revenue_kpi === false) continue;
          const _soldByProduct = onlySS ? soldByProductSS : soldByProduct;
          const _soldByCategory = onlySS ? soldByCategorySS : soldByCategory;
          const _soldByCategoryName = onlySS ? soldByCategoryNameSS : soldByCategoryName;
          const _productsByCategory = onlySS ? productsByCategorySS : productsByCategory;
          const _productsByCategoryName = onlySS ? productsByCategoryNameSS : productsByCategoryName;
          const _userRevenue = onlySS ? selfRevenueOnly : userRevenue;
          if ((c.target_type === "product" || c.target_type === "service") && c.target_id) {
            // Commission per specific product
            const sold = _soldByProduct.get(c.target_id);
            if (sold && sold.revenue > 0) {
              const amount = c.calc_type === "percentage"
                ? sold.revenue * c.value / 100
                : c.value * sold.qty;
              if (amount > 0) {
                totalCommission += amount;
                commissionDetails.push({
                  name: (c.target_name || sold.name) + (onlySS ? " (chỉ đơn tự bán)" : ""),
                  target_type: c.target_type,
                  qty: sold.qty,
                  revenue: sold.revenue,
                  rate: c.value,
                  calc_type: c.calc_type,
                  amount: Math.round(amount),
                  products: [{ name: sold.name, qty: sold.qty, revenue: sold.revenue }],
                  only_self_sold: onlySS,
                });
                processedProducts.add(c.target_id);
              }
            } else if (onlySS) {
              // Hiển thị quy tắc tự bán dù chưa có đơn nào tick → 0đ
              commissionDetails.push({
                name: (c.target_name || "Sản phẩm") + " (chỉ đơn tự bán)",
                target_type: c.target_type,
                qty: 0,
                revenue: 0,
                rate: c.value,
                calc_type: c.calc_type,
                amount: 0,
                products: [],
                only_self_sold: true,
              });
            }
          } else if (c.target_type === "category" && (c.target_id || c.target_name)) {
            // Commission per category (excluding already-processed products)
            const catSold = (c.target_id ? _soldByCategory.get(c.target_id) : undefined)
              || _soldByCategoryName.get(normalizeText(c.target_name));
            const prodMap = (c.target_id ? _productsByCategory.get(c.target_id) : undefined)
              || _productsByCategoryName.get(normalizeText(c.target_name));
            if (catSold && catSold.revenue > 0) {
              const amount = c.calc_type === "percentage"
                ? catSold.revenue * c.value / 100
                : c.value * catSold.qty;
              if (amount > 0) {
                totalCommission += amount;
                const productList = prodMap
                  ? Array.from(prodMap.values())
                      .sort((a, b) => b.revenue - a.revenue)
                      .map(p => ({ name: p.name, qty: p.qty, revenue: p.revenue }))
                  : [];
                commissionDetails.push({
                  name: (c.target_name || "Danh mục") + (onlySS ? " (chỉ đơn tự bán)" : ""),
                  target_type: "category",
                  qty: catSold.qty,
                  revenue: catSold.revenue,
                  rate: c.value,
                  calc_type: c.calc_type,
                  amount: Math.round(amount),
                  products: productList,
                  only_self_sold: onlySS,
                });
              }
            } else if (onlySS) {
              commissionDetails.push({
                name: (c.target_name || "Danh mục") + " (chỉ đơn tự bán)",
                target_type: "category",
                qty: 0,
                revenue: 0,
                rate: c.value,
                calc_type: c.calc_type,
                amount: 0,
                products: [],
                only_self_sold: true,
              });
            }
          } else if (c.target_type === "revenue") {
            // General revenue commission
            if (_userRevenue > 0) {
              const amount = c.calc_type === "percentage"
                ? _userRevenue * c.value / 100
                : c.value;
              if (amount > 0) {
                totalCommission += amount;
                const allProducts = Array.from(_soldByProduct.values())
                  .sort((a, b) => b.revenue - a.revenue)
                  .map(p => ({ name: p.name, qty: p.qty, revenue: p.revenue }));
                commissionDetails.push({
                  name: (c.target_name || "Doanh thu") + (onlySS ? " (chỉ đơn tự bán)" : ""),
                  target_type: "revenue",
                  revenue: _userRevenue,
                  rate: c.value,
                  calc_type: c.calc_type,
                  amount: Math.round(amount),
                  products: allProducts,
                  only_self_sold: onlySS,
                });
              }
            } else if (onlySS) {
              commissionDetails.push({
                name: (c.target_name || "Doanh thu") + " (chỉ đơn tự bán)",
                target_type: "revenue",
                revenue: 0,
                rate: c.value,
                calc_type: c.calc_type,
                amount: 0,
                products: [],
                only_self_sold: true,
              });
            }
          } else if (c.target_type === "self_sale") {
            // Commission cho đơn nhân viên tự bán (đã tick is_self_sold)
            const selfSales = userSales.filter((s: any) => s.is_self_sold === true);
            const selfRevenue = selfSales.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
            const selfCount = selfSales.length;
            if (selfCount > 0) {
              const amount = c.calc_type === "percentage"
                ? selfRevenue * c.value / 100
                : c.value * selfCount;
              if (amount > 0) {
                totalCommission += amount;
                commissionDetails.push({
                  name: c.target_name || "Đơn tự bán",
                  target_type: "self_sale",
                  qty: selfCount,
                  revenue: selfRevenue,
                  rate: c.value,
                  calc_type: c.calc_type,
                  amount: Math.round(amount),
                  products: [],
                });
              }
            }
          }
        }

        if (tComms.length > 0 && userRevenue > 0 && totalCommission <= 0) {
          console.log("[payroll-commission-debug]", JSON.stringify({
            user_id: employee.user_id,
            user_name: employee.display_name,
            template_id: templateId,
            user_revenue: userRevenue,
            sale_count: userSales.length,
            commission_rule_count: tComms.length,
            commission_rules: tComms.map((c: any) => ({
              target_type: c.target_type,
              target_id: c.target_id,
              target_name: c.target_name,
              calc_type: c.calc_type,
              value: c.value,
            })),
            sold_categories: Array.from(soldByCategory.entries()).map(([categoryId, sold]) => ({
              category_id: categoryId,
              category_name: categoryNameMap.get(categoryId) || null,
              qty: sold.qty,
              revenue: sold.revenue,
            })),
            sold_categories_by_name: Array.from(soldByCategoryName.entries()).map(([name, sold]) => ({
              category_name: name,
              qty: sold.qty,
              revenue: sold.revenue,
            })),
          }));
        }
      }

      // ===== 4. ALLOWANCE =====
      let totalAllowance = 0;
      const allowanceDetailsV2: any[] = [];
      if (isPayrollReady && template?.allowance_enabled) {
        // Tính tổng số ngày vắng (recorded absent + scheduled no-show) cho rule max_absent_days
        const absentRecordedForAllow = userAttendance.filter((a: any) => a.status === "absent").length;
        let absentNoShowForAllow = 0;
        for (const dateStr of scheduledDates) {
          const hasRecord = userAttendance.some((a: any) => a.date === dateStr);
          if (hasRecord) continue;
          const dateObj = new Date(dateStr);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          if (dateObj > today) continue;
          absentNoShowForAllow++;
        }
        const totalAbsentForAllow = absentRecordedForAllow + absentNoShowForAllow;

        const tAllows = allowsByTemplate[templateId] || [];
        for (const a of tAllows) {
          let amount = 0;
          const maxAbsent = Number((a as any).max_absent_days || 0);
          // Nếu cấu hình giới hạn vắng và NV vắng vượt → bỏ phụ cấp này
          if (maxAbsent > 0 && totalAbsentForAllow > maxAbsent) {
            allowanceDetailsV2.push({
              name: a.name,
              amount: 0,
              type: a.is_fixed ? "fixed" : "per_day",
              days: a.is_fixed ? null : workDays,
              skipped_reason: `Vắng ${totalAbsentForAllow} ngày > ${maxAbsent} ngày cho phép`,
            });
            continue;
          }
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
            // Lấy lương/ngày theo MỨC CHUẨN (không prorate theo ngày công thực tế)
            // VD: lương 7tr/tháng, chuẩn 30 ngày → 233k/ngày. Lễ 200% → thưởng thêm 233k.
            const dailyRate = salaryType === "fixed"
              ? (baseAmount / (expectedWorkDays || 22))
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
              // Skip if employee had an approved late_arrival request that day
              if (approvedLateArrivalKeys.has(`${employee.user_id}_${a.date}`)) continue;
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
              // Skip if employee had an approved early_leave request that day
              if (approvedEarlyLeaveKeys.has(`${employee.user_id}_${a.date}`)) continue;
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
            
            // Lương cố định: ngày vắng không phép đã được trừ tự động qua prorate base salary.
            // Ở đây CHỈ áp khoản phạt theo template (p.amount × count) bên dưới — không trừ trùng lương.
            // Lương daily/shift: vắng = không có công = không trả, nên cũng chỉ áp phạt template.
            
            detail = `${absentCount} ngày vắng (${excusedCount} có phép, ${unexcusedCount} không phép)`;
            // For the penalty amount (p.amount per violation), only apply to unexcused
            count = effectiveUnexcused;
          } else if (p.penalty_type === "violation") {
            count = 0; // manual
          }
          else if (p.penalty_type === "kpi_not_met") {
            // KPI không đạt: so sánh userRevenue với kpi_target
            const target = Number(p.kpi_target || 0);
            const tiers = Array.isArray(p.tiers) ? p.tiers : [];
            if (target > 0) {
              const achievedPct = (userRevenue / target) * 100;
              if (achievedPct < 100) {
                let penaltyAmt = 0;
                if (tiers.length > 0) {
                  // Find the smallest tier whose percent_achieved >= achievedPct
                  const sortedTiers = [...tiers].sort((a: any, b: any) => Number(a.percent_achieved) - Number(b.percent_achieved));
                  const matched = sortedTiers.find((t: any) => achievedPct <= Number(t.percent_achieved || 0));
                  if (matched) penaltyAmt = Number(matched.penalty_amount || 0);
                } else {
                  penaltyAmt = Number(p.amount || 0);
                }
                if (penaltyAmt > 0) {
                  totalPenalty += penaltyAmt;
                  penaltyDetails.push({
                    name: p.name || "Không đạt KPI",
                    type: "kpi_not_met",
                    count: 1,
                    per_amount: penaltyAmt,
                    amount: Math.round(penaltyAmt),
                    detail: `KPI đạt ${achievedPct.toFixed(1)}% (${Math.round(userRevenue).toLocaleString('vi-VN')}đ / ${target.toLocaleString('vi-VN')}đ)`,
                  });
                }
              }
            }
            // Skip the generic amount*count handler below
            continue;
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

        // Deduct full-day absences from base salary
        // For daily/shift: baseAmount IS the daily/shift rate
        // For fixed: derive from monthly salary
        if (penaltyFullDayAbsenceDays > 0 && baseSalary > 0) {
          const dailyRate = (salaryType === "fixed")
            ? (baseAmount / (expectedWorkDays || 22))
            : baseAmount; // daily/shift/hourly: baseAmount is already the unit rate
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
            const isPct = ot.calc_type === "percentage" || ot.calc_type === "multiplier";
            const amount = isPct
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
            const isPct = ot.calc_type === "percentage" || ot.calc_type === "multiplier";
            const amount = isPct
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
          completed_shifts: salaryType === "shift"
            ? userAttendance.filter((a: any) => a.check_in_time && a.check_out_time && a.shift_id && a.status !== "absent").length
            : undefined,
          user_revenue: userRevenue,
          branch_revenue: branchRevenue,
          overtime_details: overtimeDetails,
          sale_count: userSales.length,
          is_payroll_ready: isPayrollReady,
          missing_setup_reasons: missingSetupReasons,
        },
        status: "confirmed",
      });
    }

    // Upsert
    if (results.length > 0) {
      await persistPayrollResults(supabase, period_id, tenant_id, results);
    }

    // Update period status
    const { error: periodStatusErr } = await supabase
      .from("payroll_periods")
      .update({ status: "confirmed" })
      .eq("id", period_id);
    if (periodStatusErr) throw periodStatusErr;

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

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
