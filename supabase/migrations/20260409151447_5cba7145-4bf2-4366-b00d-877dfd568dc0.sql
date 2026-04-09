
-- ============================================
-- 1. WORK SHIFTS - Ca làm việc
-- ============================================
CREATE TABLE public.work_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  late_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  early_leave_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  allow_early_checkin_minutes INTEGER NOT NULL DEFAULT 30,
  overtime_enabled BOOLEAN NOT NULL DEFAULT false,
  max_overtime_minutes INTEGER DEFAULT 120,
  gps_required BOOLEAN NOT NULL DEFAULT true,
  gps_radius_meters INTEGER NOT NULL DEFAULT 200,
  device_required BOOLEAN NOT NULL DEFAULT true,
  wifi_required BOOLEAN NOT NULL DEFAULT false,
  wifi_ssid TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view shifts"
  ON public.work_shifts FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage shifts"
  ON public.work_shifts FOR ALL
  TO authenticated
  USING (tenant_id IN (
    SELECT pu.tenant_id FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
    WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
  ))
  WITH CHECK (tenant_id IN (
    SELECT pu.tenant_id FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
    WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
  ));

-- ============================================
-- 2. SHIFT ASSIGNMENTS - Xếp ca
-- ============================================
CREATE TABLE public.shift_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  shift_id UUID NOT NULL REFERENCES public.work_shifts(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL DEFAULT 'fixed' CHECK (assignment_type IN ('fixed', 'daily')),
  specific_date DATE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assignments"
  ON public.shift_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT pu.tenant_id FROM public.platform_users pu
      JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
      WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
    )
  );

CREATE POLICY "Admins can manage assignments"
  ON public.shift_assignments FOR ALL
  TO authenticated
  USING (tenant_id IN (
    SELECT pu.tenant_id FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
    WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
  ))
  WITH CHECK (tenant_id IN (
    SELECT pu.tenant_id FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
    WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
  ));

-- ============================================
-- 3. ATTENDANCE LOCATIONS - Điểm chấm công
-- ============================================
CREATE TABLE public.attendance_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 200 CHECK (radius_meters >= 50 AND radius_meters <= 500),
  qr_code TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, qr_code)
);

ALTER TABLE public.attendance_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view locations"
  ON public.attendance_locations FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage locations"
  ON public.attendance_locations FOR ALL
  TO authenticated
  USING (tenant_id IN (
    SELECT pu.tenant_id FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
    WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
  ))
  WITH CHECK (tenant_id IN (
    SELECT pu.tenant_id FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
    WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
  ));

-- ============================================
-- 4. TRUSTED DEVICES - Thiết bị tin cậy
-- ============================================
CREATE TABLE public.trusted_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT,
  user_agent TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_fingerprint)
);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON public.trusted_devices FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT pu.tenant_id FROM public.platform_users pu
      JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
      WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
    )
  );

CREATE POLICY "Users can register own devices"
  ON public.trusted_devices FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage devices"
  ON public.trusted_devices FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT pu.tenant_id FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
    WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
  ));

CREATE POLICY "Admins can delete devices"
  ON public.trusted_devices FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT pu.tenant_id FROM public.platform_users pu
      JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
      WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
    )
  );

-- ============================================
-- 5. ATTENDANCE RECORDS - Bản ghi chấm công
-- ============================================
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  shift_id UUID REFERENCES public.work_shifts(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.attendance_locations(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  check_in_device_id UUID REFERENCES public.trusted_devices(id),
  check_out_device_id UUID REFERENCES public.trusted_devices(id),
  check_in_method TEXT CHECK (check_in_method IN ('gps', 'qr', 'pos', 'manual')),
  check_out_method TEXT CHECK (check_out_method IN ('gps', 'qr', 'pos', 'manual', 'auto')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('on_time', 'late', 'early_leave', 'absent', 'pending', 'day_off')),
  late_minutes INTEGER DEFAULT 0,
  early_leave_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  total_work_minutes INTEGER DEFAULT 0,
  is_auto_checkout BOOLEAN DEFAULT false,
  check_in_ip TEXT,
  check_out_ip TEXT,
  check_in_accuracy DOUBLE PRECISION,
  check_out_accuracy DOUBLE PRECISION,
  note TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, date, shift_id)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT pu.tenant_id FROM public.platform_users pu
      JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
      WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
    )
  );

CREATE POLICY "Users can check in"
  ON public.attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can check out own record"
  ON public.attendance_records FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT pu.tenant_id FROM public.platform_users pu
      JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
      WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
    )
  );

-- ============================================
-- 6. ATTENDANCE CORRECTIONS - Chỉnh sửa chấm công
-- ============================================
CREATE TABLE public.attendance_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  attendance_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  corrected_by UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view corrections"
  ON public.attendance_corrections FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT pu.tenant_id FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
    WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
  ));

CREATE POLICY "Admins can create corrections"
  ON public.attendance_corrections FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT pu.tenant_id FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id AND ur.tenant_id = pu.tenant_id
    WHERE pu.user_id = auth.uid() AND ur.user_role IN ('super_admin', 'branch_admin')
  ));

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_work_shifts_tenant ON public.work_shifts(tenant_id);
CREATE INDEX idx_shift_assignments_tenant_user ON public.shift_assignments(tenant_id, user_id);
CREATE INDEX idx_shift_assignments_date ON public.shift_assignments(specific_date);
CREATE INDEX idx_attendance_locations_tenant ON public.attendance_locations(tenant_id);
CREATE INDEX idx_attendance_locations_qr ON public.attendance_locations(qr_code);
CREATE INDEX idx_trusted_devices_user ON public.trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_fingerprint ON public.trusted_devices(device_fingerprint);
CREATE INDEX idx_attendance_records_tenant_date ON public.attendance_records(tenant_id, date);
CREATE INDEX idx_attendance_records_user_date ON public.attendance_records(user_id, date);
CREATE INDEX idx_attendance_corrections_attendance ON public.attendance_corrections(attendance_id);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE TRIGGER update_work_shifts_updated_at
  BEFORE UPDATE ON public.work_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shift_assignments_updated_at
  BEFORE UPDATE ON public.shift_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_locations_updated_at
  BEFORE UPDATE ON public.attendance_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trusted_devices_updated_at
  BEFORE UPDATE ON public.trusted_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Enable Realtime for attendance_records
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
