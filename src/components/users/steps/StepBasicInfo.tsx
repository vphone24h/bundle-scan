import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserRole } from '@/hooks/usePermissions';
import { PermissionEditor } from '../PermissionEditor';
import { PermissionMap, getDefaultPermissionsForRole } from '@/config/permissionDefinitions';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export interface BasicInfoData {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  role: UserRole;
  customRoleName: string;
  useCustomRole: boolean;
  branchId: string;
}

interface Props {
  data: BasicInfoData;
  onChange: (data: BasicInfoData) => void;
  branches: { id: string; name: string }[] | undefined;
  permissions: PermissionMap;
  onPermissionsChange: (p: PermissionMap) => void;
}

const PRESET_ROLES: { value: UserRole; label: string }[] = [
  { value: 'branch_admin', label: 'Admin Chi nhánh' },
  { value: 'cashier', label: 'Kế toán' },
  { value: 'staff', label: 'Nhân viên' },
];

export function StepBasicInfo({ data, onChange, branches, permissions, onPermissionsChange }: Props) {
  const [showPermissions, setShowPermissions] = useState(false);

  const update = (patch: Partial<BasicInfoData>) => onChange({ ...data, ...patch });

  const handleRoleChange = (value: string) => {
    if (value === '_custom') {
      update({ useCustomRole: true });
      onPermissionsChange(getDefaultPermissionsForRole('staff'));
    } else {
      update({ useCustomRole: false, role: value as UserRole });
      onPermissionsChange(getDefaultPermissionsForRole(value));
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
          <Input type="email" placeholder="email@example.com" value={data.email} onChange={e => update({ email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mật khẩu <span className="text-destructive">*</span></Label>
          <Input type="password" placeholder="Tối thiểu 6 ký tự" value={data.password} onChange={e => update({ password: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tên hiển thị <span className="text-destructive">*</span></Label>
          <Input placeholder="Nguyễn Văn A" value={data.displayName} onChange={e => update({ displayName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Số điện thoại</Label>
          <Input placeholder="0901234567" value={data.phone} onChange={e => update({ phone: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Vai trò <span className="text-destructive">*</span></Label>
          <Select value={data.useCustomRole ? '_custom' : data.role} onValueChange={handleRoleChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRESET_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              <SelectItem value="_custom">Tự nhập vai trò...</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Chi nhánh <span className="text-destructive">*</span></Label>
          <Select value={data.branchId} onValueChange={v => update({ branchId: v })}>
            <SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
            <SelectContent>
              {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {data.useCustomRole && (
        <div className="space-y-1.5">
          <Label className="text-xs">Tên vai trò tùy chỉnh</Label>
          <Input placeholder="VD: Quản lý kho" value={data.customRoleName} onChange={e => update({ customRoleName: e.target.value })} />
        </div>
      )}

      <Collapsible open={showPermissions} onOpenChange={setShowPermissions}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
          <ChevronDown className={`h-3 w-3 transition-transform ${showPermissions ? 'rotate-180' : ''}`} />
          {showPermissions ? 'Ẩn phân quyền' : 'Xem & chỉnh phân quyền'}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <PermissionEditor
            permissions={permissions}
            onChange={onPermissionsChange}
            currentRole={data.useCustomRole ? undefined : data.role}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
