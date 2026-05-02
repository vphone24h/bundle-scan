import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CorrectionRequest = {
  id: string
  tenant_id: string
  user_id: string
  request_type: 'correction' | 'remote_checkin' | 'remote_checkout'
  request_date: string
  requested_check_in: string | null
  requested_check_out: string | null
  reason: string
  status: string
  review_note: string | null
}

function ok(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function fail(error: string, errorCode: string, extra?: Record<string, unknown>) {
  return ok({ success: false, error, errorCode, ...extra })
}

function appendNote(existingNote: string | null, extraNote: string) {
  return existingNote ? `${existingNote} | ${extraNote}` : extraNote
}

async function buildAttendancePayload(supabaseAdmin: ReturnType<typeof createClient>, request: CorrectionRequest, currentRecord?: any) {
  const effectiveCheckIn = request.requested_check_in || currentRecord?.check_in_time || null
  const effectiveCheckOut = request.requested_check_out || currentRecord?.check_out_time || null
  const hasCheckIn = !!effectiveCheckIn
  const hasCheckOut = !!effectiveCheckOut

  if (!hasCheckIn && !hasCheckOut) {
    return null
  }

  const baseTime = new Date(effectiveCheckIn || effectiveCheckOut)
  const dayOfWeek = baseTime.getDay()

  const { data: shift, error: shiftError } = await supabaseAdmin
    .from('shift_assignments')
    .select('shift_id, work_shifts(start_time, end_time, late_threshold_minutes)')
    .eq('user_id', request.user_id)
    .eq('tenant_id', request.tenant_id)
    .eq('is_active', true)
    .or(`specific_date.eq.${request.request_date},and(assignment_type.eq.fixed,day_of_week.eq.${dayOfWeek})`)
    .limit(1)
    .maybeSingle()

  if (shiftError) {
    throw shiftError
  }

  let recordStatus = currentRecord?.status || 'on_time'
  let lateMinutes = 0
  let earlyLeaveMinutes = 0
  let overtimeMinutes = 0
  let totalMinutes = currentRecord?.total_work_minutes || 0

  if (hasCheckIn && shift?.work_shifts) {
    const ws = shift.work_shifts as any
    const [h, m] = String(ws.start_time || '00:00').split(':').map(Number)
    const shiftStart = new Date(effectiveCheckIn)
    shiftStart.setHours(h, m, 0, 0)
    const threshold = (Number(ws.late_threshold_minutes) || 15) * 60 * 1000
    const diff = new Date(effectiveCheckIn).getTime() - shiftStart.getTime()
    if (diff > threshold) {
      recordStatus = 'late'
      lateMinutes = Math.round(diff / 60000)
    } else {
      recordStatus = 'on_time'
    }
  }

  if (hasCheckIn && hasCheckOut) {
    const checkInTime = new Date(effectiveCheckIn)
    const checkOutTime = new Date(effectiveCheckOut)
    totalMinutes = Math.max(0, Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000))

    if (shift?.work_shifts) {
      const ws = shift.work_shifts as any
      const [eh, em] = String(ws.end_time || '00:00').split(':').map(Number)
      const shiftEnd = new Date(checkOutTime)
      shiftEnd.setHours(eh, em, 0, 0)
      const diffFromEnd = Math.round((checkOutTime.getTime() - shiftEnd.getTime()) / 60000)
      if (diffFromEnd > 0) overtimeMinutes = diffFromEnd
      if (diffFromEnd < 0) {
        earlyLeaveMinutes = Math.abs(diffFromEnd)
        if (recordStatus === 'on_time') recordStatus = 'early_leave'
      }
    }
  }

  return {
    shiftId: shift?.shift_id || currentRecord?.shift_id || null,
    updates: {
      check_in_time: request.requested_check_in ?? currentRecord?.check_in_time ?? null,
      check_out_time: request.requested_check_out ?? currentRecord?.check_out_time ?? null,
      check_in_method: request.requested_check_in ? 'manual' : currentRecord?.check_in_method,
      check_out_method: request.requested_check_out ? 'manual' : currentRecord?.check_out_method,
      status: hasCheckIn ? recordStatus : currentRecord?.status,
      late_minutes: lateMinutes,
      early_leave_minutes: earlyLeaveMinutes,
      overtime_minutes: overtimeMinutes,
      total_work_minutes: totalMinutes,
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Không có quyền truy cập' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Không thể xác thực người dùng' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { requestId, action, reviewNote } = await req.json()
    if (!requestId || !['approved', 'rejected'].includes(action)) {
      return fail('Thiếu thông tin duyệt sửa công', 'INVALID_PAYLOAD')
    }

    const { data: request, error: requestError } = await supabaseAdmin
      .from('attendance_correction_requests')
      .select('*')
      .eq('id', requestId)
      .limit(1)
      .maybeSingle()

    if (requestError) throw requestError
    if (!request) {
      return fail('Không tìm thấy yêu cầu sửa công', 'REQUEST_NOT_FOUND')
    }

    const { data: platformUser, error: platformUserError } = await supabaseAdmin
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', caller.id)
      .eq('tenant_id', request.tenant_id)
      .limit(1)
      .maybeSingle()

    if (platformUserError) throw platformUserError

    const { data: userRole, error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_role')
      .eq('user_id', caller.id)
      .eq('tenant_id', request.tenant_id)
      .limit(1)
      .maybeSingle()

    if (userRoleError) throw userRoleError

    const allowedPlatformRoles = new Set(['tenant_admin', 'company_admin', 'platform_admin'])
    const allowedUserRoles = new Set(['super_admin', 'branch_admin'])
    const canReview = allowedPlatformRoles.has(String(platformUser?.platform_role || '')) || allowedUserRoles.has(String(userRole?.user_role || ''))

    if (!canReview) {
      return fail('Bạn không có quyền duyệt yêu cầu này', 'FORBIDDEN')
    }

    if (request.status !== 'pending') {
      return fail('Yêu cầu này đã được xử lý trước đó', 'REQUEST_ALREADY_REVIEWED', { status: request.status })
    }

    if (action === 'rejected') {
      const { error: rejectError } = await supabaseAdmin
        .from('attendance_correction_requests')
        .update({
          status: 'rejected',
          reviewed_by: caller.id,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote || null,
        })
        .eq('id', requestId)

      if (rejectError) throw rejectError
      return ok({ success: true })
    }

    const { data: existingRecord, error: existingRecordError } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('tenant_id', request.tenant_id)
      .eq('user_id', request.user_id)
      .eq('date', request.request_date)
      .limit(1)
      .maybeSingle()

    if (existingRecordError) throw existingRecordError

    if (request.request_type === 'remote_checkout' && !existingRecord) {
      return fail('Không tìm thấy bản ghi check-in để duyệt check-out từ xa', 'ATTENDANCE_NOT_FOUND')
    }

    if (request.request_type === 'remote_checkout' && !existingRecord?.check_in_time) {
      return fail('Bản ghi chấm công chưa có giờ check-in nên không thể duyệt check-out', 'MISSING_CHECKIN')
    }

    const attendancePayload = await buildAttendancePayload(supabaseAdmin, request as CorrectionRequest, existingRecord)
    if (!attendancePayload) {
      return fail('Yêu cầu không có dữ liệu chấm công để cập nhật', 'NO_ATTENDANCE_DATA')
    }

    const noteByType: Record<string, string> = {
      correction: `✅ Sửa công được duyệt bởi admin. Lý do: ${request.reason}`,
      remote_checkin: `✅ Check-in từ xa được duyệt bởi admin. Lý do: ${request.reason}`,
      remote_checkout: `✅ Check-out từ xa được duyệt bởi admin. Lý do: ${request.reason}`,
    }

    const baseUpdates = {
      ...attendancePayload.updates,
      note: appendNote(existingRecord?.note || null, noteByType[request.request_type] || noteByType.correction),
    }

    let attendanceId = existingRecord?.id as string | undefined

    if (existingRecord) {
      const { error: updateError } = await supabaseAdmin
        .from('attendance_records')
        .update(baseUpdates)
        .eq('id', existingRecord.id)

      if (updateError) throw updateError
    } else {
      const { data: insertedRecord, error: insertError } = await supabaseAdmin
        .from('attendance_records')
        .insert({
          tenant_id: request.tenant_id,
          user_id: request.user_id,
          date: request.request_date,
          shift_id: attendancePayload.shiftId,
          ...baseUpdates,
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      attendanceId = insertedRecord.id
    }

    const { error: approveError } = await supabaseAdmin
      .from('attendance_correction_requests')
      .update({
        status: 'approved',
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote || null,
      })
      .eq('id', requestId)

    if (approveError) throw approveError

    return ok({ success: true, attendanceId })
  } catch (error) {
    console.error('review-attendance-correction error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'Lỗi hệ thống khi duyệt sửa công',
      detail: (error as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})