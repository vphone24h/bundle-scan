import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Auto-checkout expired records (from previous days)
    const { data: autoCheckedOut, error: autoErr } = await supabase.rpc('auto_checkout_expired');
    if (autoErr) console.error("Auto checkout error:", autoErr);

    // 2. Find pending records from today that might need a warning
    const today = new Date().toISOString().split('T')[0];
    const { data: pendingRecords, error: pendingErr } = await supabase
      .from('attendance_records')
      .select('id, user_id, tenant_id, check_in_time, shift_id, work_shifts(end_time)')
      .eq('date', today)
      .eq('status', 'pending')
      .is('check_out_time', null);

    if (pendingErr) {
      console.error("Pending records error:", pendingErr);
    }

    const now = new Date();
    let warningsSent = 0;

    // Send warnings for records approaching shift end
    for (const record of (pendingRecords || [])) {
      const ws = record.work_shifts as any;
      if (!ws?.end_time) continue;

      const [h, m] = ws.end_time.split(':').map(Number);
      const shiftEnd = new Date();
      shiftEnd.setHours(h, m, 0, 0);

      const minutesLeft = (shiftEnd.getTime() - now.getTime()) / 60000;

      // Warn 15 minutes before shift end
      if (minutesLeft > 0 && minutesLeft <= 15) {
        const { error: notifErr } = await supabase
          .from('crm_notifications')
          .insert({
            tenant_id: record.tenant_id,
            user_id: record.user_id,
            notification_type: 'checkout_reminder',
            title: 'Nhắc nhở checkout',
            message: `Ca làm sắp kết thúc lúc ${ws.end_time.slice(0, 5)}. Hãy checkout trước khi rời đi.`,
            reference_type: 'attendance',
            reference_id: record.id,
          });
        if (!notifErr) warningsSent++;
      }
    }

    // 3. Check for staff who haven't checked in yet today
    // Ưu tiên ca cụ thể (specific_date) theo từng user; nếu không có mới fallback fixed.
    const dayOfWeek = now.getDay();
    const { data: rawAssignments } = await supabase
      .from('shift_assignments')
      .select('user_id, tenant_id, shift_id, assignment_type, specific_date, work_shifts(start_time, end_time, name)')
      .eq('is_active', true)
      .or(`specific_date.eq.${today},and(assignment_type.eq.fixed,day_of_week.eq.${dayOfWeek})`);
    const byUser = new Map<string, any>();
    for (const a of (rawAssignments || [])) {
      const existing = byUser.get(a.user_id);
      // specific_date thắng fixed
      if (!existing || (a.specific_date === today && existing.specific_date !== today)) {
        byUser.set(a.user_id, a);
      }
    }
    const todayAssignments = Array.from(byUser.values());

    const { data: todayRecords } = await supabase
      .from('attendance_records')
      .select('user_id')
      .eq('date', today);

    const checkedInUsers = new Set((todayRecords || []).map(r => r.user_id));
    let remindersSent = 0;
    let absentMarked = 0;

    for (const assignment of (todayAssignments || [])) {
      if (checkedInUsers.has(assignment.user_id)) continue;
      
      const ws = assignment.work_shifts as any;
      if (!ws?.start_time) continue;

      const [h, m] = ws.start_time.split(':').map(Number);
      const shiftStart = new Date();
      shiftStart.setHours(h, m, 0, 0);
      
      const minutesLate = (now.getTime() - shiftStart.getTime()) / 60000;

      // Auto-mark absent if shift has ended and no check-in
      if (ws.end_time) {
        const [eh, em] = ws.end_time.split(':').map(Number);
        const shiftEnd = new Date();
        shiftEnd.setHours(eh, em, 0, 0);
        const minutesPastEnd = (now.getTime() - shiftEnd.getTime()) / 60000;
        
        if (minutesPastEnd > 30) {
          // Shift ended 30+ min ago, mark as absent
          const { error: absentErr } = await supabase.from('attendance_records').insert({
            tenant_id: assignment.tenant_id,
            user_id: assignment.user_id,
            date: today,
            shift_id: assignment.shift_id,
            status: 'absent',
            note: 'Tự động đánh dấu vắng - không chấm công',
            is_auto_checkout: true,
          });
          if (!absentErr) {
            absentMarked++;
            // Notify
            await supabase.from('crm_notifications').insert({
              tenant_id: assignment.tenant_id,
              user_id: assignment.user_id,
              notification_type: 'attendance_absent',
              title: 'Vắng mặt',
              message: `Bạn đã bị đánh dấu vắng cho ca ${ws.name} ngày ${today}.`,
              reference_type: 'shift_assignment',
              reference_id: assignment.shift_id,
            });
          }
          continue;
        }
      }

      // Send reminder if 30+ minutes late and hasn't checked in
      if (minutesLate >= 30 && minutesLate < 45) {
        await supabase.from('crm_notifications').insert({
          tenant_id: assignment.tenant_id,
          user_id: assignment.user_id,
          notification_type: 'checkin_reminder',
          title: 'Nhắc nhở chấm công',
          message: `Bạn chưa chấm công cho ca ${ws.name} (${ws.start_time.slice(0, 5)}). Vui lòng chấm công ngay.`,
          reference_type: 'shift_assignment',
          reference_id: assignment.shift_id,
        });
        remindersSent++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        auto_checkout: 'completed',
        checkout_warnings: warningsSent,
        checkin_reminders: remindersSent,
        absent_marked: absentMarked,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
