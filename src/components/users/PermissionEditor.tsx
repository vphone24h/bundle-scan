import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PERMISSION_CATEGORIES, PermissionMap } from '@/config/permissionDefinitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RoleHint {
  icon: string;
  title: string;
  allowed: string[];
  restricted: string[];
}

const ROLE_HINTS: Record<string, RoleHint> = {
  cashier: {
    icon: '👤',
    title: 'KẾ TOÁN',
    allowed: [
      'Xem tồn kho, giá nhập, giá vốn',
      'Xem lịch sử nhập – xuất',
      'Xem & quản lý công nợ, sổ quỹ',
      'Xem báo cáo tồn kho, lãi lỗ, giá trị kho',
    ],
    restricted: [
      'Không sửa tồn kho trực tiếp',
      'Không xoá phiếu nhập/xuất',
      'Không chỉnh giá bán (tuỳ cấu hình)',
    ],
  },
  branch_admin: {
    icon: '🧑‍💼',
    title: 'QUẢN LÝ CHI NHÁNH',
    allowed: [
      'Quản lý dữ liệu trong chi nhánh',
      'Tạo / sửa / xoá phiếu nhập – xuất',
      'Điều chỉnh tồn kho, xem giá nhập/bán',
      'Xem báo cáo kho, doanh thu, lợi nhuận',
      'Duyệt phiếu & phân công nhân viên',
    ],
    restricted: [
      'Không xem chi nhánh khác (trừ khi cấp quyền)',
      'Không chỉnh cấu hình hệ thống',
    ],
  },
  staff: {
    icon: '👨‍🔧',
    title: 'NHÂN VIÊN',
    allowed: [
      'Xem sản phẩm, tồn kho cơ bản',
      'Tạo phiếu bán hàng / xuất kho',
      'Tạo phiếu nhập (nếu cho phép)',
    ],
    restricted: [
      'Không thấy giá nhập / lợi nhuận',
      'Không xem báo cáo tổng',
      'Không xoá dữ liệu quan trọng',
      'Không điều chỉnh tồn kho',
    ],
  },
};

interface PermissionEditorProps {
  permissions: PermissionMap;
  onChange: (permissions: PermissionMap) => void;
  disabled?: boolean;
  currentRole?: string;
  onRoleChange?: (role: string) => void;
}

const QUICK_ROLES = [
  { value: 'cashier', label: '👤 Kế toán' },
  { value: 'branch_admin', label: '🧑‍💼 Quản lý' },
  { value: 'staff', label: '👨‍🔧 Nhân viên' },
];

export function PermissionEditor({ permissions, onChange, disabled, currentRole, onRoleChange }: PermissionEditorProps) {
  const [hintOpen, setHintOpen] = useState(true);
  const [selectedQuickRole, setSelectedQuickRole] = useState<string | null>(currentRole || null);
  const hint = selectedQuickRole ? ROLE_HINTS[selectedQuickRole] : null;

  const handleQuickRole = (role: string) => {
    setSelectedQuickRole(role);
    onChange(getDefaultPermissionsForRole(role));
    onRoleChange?.(role);
  };

  const togglePermission = (key: string, checked: boolean) => {
    onChange({ ...permissions, [key]: checked });
  };

  const toggleCategory = (categoryKey: string, checked: boolean) => {
    const category = PERMISSION_CATEGORIES.find(c => c.key === categoryKey);
    if (!category) return;
    const updates = { ...permissions };
    category.children.forEach(child => { updates[child.key] = checked; });
    onChange(updates);
  };

  const isCategoryChecked = (categoryKey: string): boolean => {
    const category = PERMISSION_CATEGORIES.find(c => c.key === categoryKey);
    if (!category) return false;
    return category.children.every(child => permissions[child.key]);
  };

  const isCategoryIndeterminate = (categoryKey: string): boolean => {
    const category = PERMISSION_CATEGORIES.find(c => c.key === categoryKey);
    if (!category) return false;
    const checked = category.children.filter(child => permissions[child.key]).length;
    return checked > 0 && checked < category.children.length;
  };

  return (
    <ScrollArea className="h-[400px] pr-3">
      <div className="space-y-4">
        {/* Role hint */}
        {hint && (
          <Collapsible open={hintOpen} onOpenChange={setHintOpen}>
            <div className="border rounded-lg bg-accent/30 overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{hint.icon} {hint.title}</span>
                </div>
                {hintOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2">
                  <div>
                    <p className="text-[11px] font-medium text-green-600 mb-1">✅ Được phép:</p>
                    <ul className="space-y-0.5">
                      {hint.allowed.map((item, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground pl-3">• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-destructive mb-1">❌ Hạn chế:</p>
                    <ul className="space-y-0.5">
                      {hint.restricted.map((item, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground pl-3">• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Bạn có thể tuỳ chỉnh quyền bên dưới.</p>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {PERMISSION_CATEGORIES.map(category => {
          const allChecked = isCategoryChecked(category.key);
          const indeterminate = isCategoryIndeterminate(category.key);
          const hasMultipleChildren = category.children.length > 1;

          return (
            <div key={category.key} className="border rounded-lg p-3 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id={`cat-${category.key}`}
                  checked={indeterminate ? 'indeterminate' : allChecked}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggleCategory(category.key, !!checked)}
                />
                <Label htmlFor={`cat-${category.key}`} className="text-sm font-semibold cursor-pointer">
                  {category.label}
                </Label>
                {!allChecked && !indeterminate && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Ẩn</Badge>
                )}
              </div>

              {hasMultipleChildren && (
                <div className="ml-6 space-y-2">
                  {category.children.map(child => (
                    <div key={child.key} className="flex items-start gap-2">
                      <Checkbox
                        id={`perm-${child.key}`}
                        checked={!!permissions[child.key]}
                        disabled={disabled}
                        onCheckedChange={(checked) => togglePermission(child.key, !!checked)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={`perm-${child.key}`} className="text-xs cursor-pointer leading-tight">
                          {child.label}
                        </Label>
                        {child.description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{child.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
