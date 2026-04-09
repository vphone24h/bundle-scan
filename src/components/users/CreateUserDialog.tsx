import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ArrowRight, ArrowLeft, Crown } from 'lucide-react';
import { UserRole } from '@/hooks/usePermissions';
import { PermissionEditor } from './PermissionEditor';
import { PermissionMap, getDefaultPermissionsForRole } from '@/config/permissionDefinitions';
import { useSaveCustomPermissions } from '@/hooks/useCustomPermissions';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useAuditLog } from '@/hooks/usePermissions';

interface Branch {
  id: string;
  name: string;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[] | undefined;
}

const PRESET_ROLES: { value: UserRole; label: string }[] = [
  { value: 'branch_admin', label: 'Admin Chi nhánh' },
  { value: 'cashier', label: 'Kế toán' },
  { value: 'staff', label: 'Nhân viên' },
];

export function CreateUserDialog({
  open,
  onOpenChange,
  branches,
}: CreateUserDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentTenant } = useCurrentTenant();
  const savePermissions = useSaveCustomPermissions();
  const { logAction } = useAuditLog();

  const [step, setStep] = useState<1 | 2>(1);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [customRoleName, setCustomRoleName] = useState('');
  const [useCustomRole, setUseCustomRole] = useState(false);
  const [newBranchId, setNewBranchId] = useState<string>('');
  const [permissions, setPermissions] = useState<PermissionMap>(() =>
    getDefaultPermissionsForRole('super_admin')
  );
  const [memberLimitError, setMemberLimitError] = useState<{
    currentCount: number;
    maxUsers: number;
    message: string;
  } | null>(null);

  const resetForm = () => {
    setStep(1);
    setNewEmail('');
    setNewPassword('');
    setNewDisplayName('');
    setNewPhone('');
    setNewRole('staff');
    setCustomRoleName('');
    setUseCustomRole(false);
    setNewBranchId('');
    setPermissions(getDefaultPermissionsForRole('super_admin'));
    setMemberLimitError(null);
  };

  const handleRoleChange = (value: string) => {
    if (value === '_custom') {
      setUseCustomRole(true);
      setPermissions(getDefaultPermissionsForRole('super_admin'));
    } else {
      setUseCustomRole(false);
      setNewRole(value as UserRole);
      setPermissions(getDefaultPermissionsForRole(value));
    }
  };

  const createUser = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: newEmail,
          password: newPassword,
          displayName: newDisplayName,
          phone: newPhone,
          role: useCustomRole ? 'staff' : newRole,
          branchId: newBranchId || null,
        },
      });

      // Check structured error in data first (e.g. 403 MEMBER_LIMIT_REACHED)
      if (response.data?.errorCode) {
        const err = new Error(response.data.error) as any;
        err.errorCode = response.data.errorCode;
        err.maxUsers = response.data.maxUsers;
        err.currentCount = response.data.currentCount;
        throw err;
      }
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      if (response.error) throw new Error(response.error.message);

      // Save custom permissions
      const userId = response.data?.userId;
      if (userId && currentTenant?.id) {
        await savePermissions.mutateAsync({
          userId,
          tenantId: currentTenant.id,
          permissions,
        });

        // Log
        await logAction({
          actionType: 'create',
          tableName: 'user_custom_permissions',
          recordId: userId,
          newData: { permissions, role: useCustomRole ? customRoleName : newRole },
          description: `Tạo tài khoản ${newDisplayName} với phân quyền tùy chỉnh`,
        });
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Tạo tài khoản thành công');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.errorCode === 'MEMBER_LIMIT_REACHED') {
        setMemberLimitError({
          currentCount: error.currentCount || 0,
          maxUsers: error.maxUsers || 0,
          message: error.message,
        });
      } else {
        toast.error('Lỗi: ' + error.message);
      }
    },
  });

  const handleNext = () => {
    if (!newEmail || !newPassword || !newDisplayName) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (!newBranchId) {
      toast.error('Vui lòng chọn chi nhánh');
      return;
    }
    setStep(2);
  };

  const handleCreate = () => {
    createUser.mutate();
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Bước 1: Thông tin tài khoản' : 'Bước 2: Phân quyền'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Nhập thông tin cơ bản cho tài khoản mới'
              : 'Tick chọn các quyền cho tài khoản'}
          </DialogDescription>
        </DialogHeader>

        {memberLimitError ? (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-full bg-amber-100 p-3">
                <Crown className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-amber-600">Đã đạt giới hạn thành viên</h3>
              <p className="text-sm text-muted-foreground">
                Cửa hàng của bạn đã có <strong className="text-foreground">{memberLimitError.currentCount}</strong> / <strong className="text-foreground">{memberLimitError.maxUsers}</strong> thành viên.
              </p>
              <p className="text-sm text-muted-foreground">
                Vui lòng nâng cấp lên gói cao hơn để thêm thành viên.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                onClick={() => {
                  handleOpenChange(false);
                  navigate('/subscription');
                }}
              >
                <Crown className="h-4 w-4 mr-2" />
                Nâng cấp ngay
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setMemberLimitError(null)}>
                Quay lại
              </Button>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Mật khẩu <span className="text-destructive">*</span></Label>
              <Input
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tên hiển thị <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Nguyễn Văn A"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input
                placeholder="0901234567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Vai trò <span className="text-destructive">*</span></Label>
              <Select
                value={useCustomRole ? '_custom' : newRole}
                onValueChange={handleRoleChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                  <SelectItem value="_custom">Tự nhập vai trò...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {useCustomRole && (
              <div className="space-y-2">
                <Label>Tên vai trò tùy chỉnh</Label>
                <Input
                  placeholder="VD: Quản lý kho"
                  value={customRoleName}
                  onChange={(e) => setCustomRoleName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Vai trò tùy chỉnh sẽ không có quyền mặc định. Bạn sẽ chọn quyền ở bước 2.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Chi nhánh <span className="text-destructive">*</span></Label>
              <Select value={newBranchId} onValueChange={setNewBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn chi nhánh" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <PermissionEditor
              permissions={permissions}
              onChange={setPermissions}
              currentRole={useCustomRole ? undefined : newRole}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Quay lại
            </Button>
          )}
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button onClick={handleNext}>
                Tiếp tục
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <Button onClick={handleCreate} disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tạo tài khoản
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
