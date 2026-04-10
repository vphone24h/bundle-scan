import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Smartphone, QrCode, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentTenant } from '@/hooks/useTenant';

export interface AttendanceSetupData {
  allowGps: boolean;
  allowQr: boolean;
  allowPos: boolean;
  locationId?: string;
  maxDevices: number;
  requireDeviceApproval: boolean;
}

interface Props {
  data: AttendanceSetupData;
  onChange: (d: AttendanceSetupData) => void;
}

export function StepAttendanceSetup({ data, onChange }: Props) {
  const { data: currentTenant } = useCurrentTenant();

  const { data: locations } = useQuery({
    queryKey: ['attendance-locations', currentTenant?.id],
    queryFn: async () => {
      const { data: locs } = await supabase
        .from('attendance_locations')
        .select('id, name, address, radius_meters, is_active')
        .eq('tenant_id', currentTenant!.id)
        .eq('is_active', true);
      return locs || [];
    },
    enabled: !!currentTenant?.id,
  });

  const METHODS = [
    { key: 'allowGps' as const, icon: MapPin, label: 'GPS', desc: 'Tự tìm kho gần nhất' },
    { key: 'allowQr' as const, icon: QrCode, label: 'Quét QR', desc: 'Quét mã QR tại kho' },
    { key: 'allowPos' as const, icon: Smartphone, label: 'Máy POS', desc: 'Thiết bị tin cậy' },
  ];

  return (
    <div className="space-y-4">
      {/* Check-in methods */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Phương thức chấm công</Label>
        <div className="grid gap-2">
          {METHODS.map(m => {
            const enabled = data[m.key];
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border transition-colors',
                  enabled && 'border-primary bg-primary/5',
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={v => onChange({ ...data, [m.key]: v })}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Location */}
      {data.allowGps && (
        <div className="space-y-1.5">
          <Label className="text-xs">Địa điểm chấm công mặc định</Label>
          <Select
            value={data.locationId || '_auto'}
            onValueChange={v => onChange({ ...data, locationId: v === '_auto' ? undefined : v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_auto">Tự động (kho gần nhất)</SelectItem>
              {locations?.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} {l.address ? `- ${l.address}` : ''} ({l.radius_meters}m)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(!locations || locations.length === 0) && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Chưa có địa điểm. Thêm tại module Chấm công.
            </p>
          )}
        </div>
      )}

      {/* Device settings */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Thiết bị</Label>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="text-sm font-medium">Yêu cầu duyệt thiết bị</p>
              <p className="text-xs text-muted-foreground">Thiết bị mới cần admin duyệt</p>
            </div>
            <Switch
              checked={data.requireDeviceApproval}
              onCheckedChange={v => onChange({ ...data, requireDeviceApproval: v })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Số thiết bị tối đa / nhân viên</Label>
            <Select
              value={String(data.maxDevices)}
              onValueChange={v => onChange({ ...data, maxDevices: Number(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 thiết bị</SelectItem>
                <SelectItem value="2">2 thiết bị</SelectItem>
                <SelectItem value="3">3 thiết bị</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-xs font-medium mb-2">Tóm tắt cấu hình:</p>
        <div className="flex flex-wrap gap-1">
          {data.allowGps && <Badge variant="secondary" className="text-xs">GPS</Badge>}
          {data.allowQr && <Badge variant="secondary" className="text-xs">QR Code</Badge>}
          {data.allowPos && <Badge variant="secondary" className="text-xs">Máy POS</Badge>}
          <Badge variant="outline" className="text-xs">Tối đa {data.maxDevices} thiết bị</Badge>
          {data.requireDeviceApproval && <Badge variant="outline" className="text-xs">Cần duyệt TB</Badge>}
        </div>
      </div>
    </div>
  );
}
