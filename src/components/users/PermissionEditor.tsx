import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PERMISSION_CATEGORIES, PermissionMap } from '@/config/permissionDefinitions';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PermissionEditorProps {
  permissions: PermissionMap;
  onChange: (permissions: PermissionMap) => void;
  disabled?: boolean;
}

export function PermissionEditor({ permissions, onChange, disabled }: PermissionEditorProps) {
  const togglePermission = (key: string, checked: boolean) => {
    onChange({ ...permissions, [key]: checked });
  };

  const toggleCategory = (categoryKey: string, checked: boolean) => {
    const category = PERMISSION_CATEGORIES.find(c => c.key === categoryKey);
    if (!category) return;

    const updates = { ...permissions };
    category.children.forEach(child => {
      updates[child.key] = checked;
    });
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
        {PERMISSION_CATEGORIES.map(category => {
          const allChecked = isCategoryChecked(category.key);
          const indeterminate = isCategoryIndeterminate(category.key);
          const hasMultipleChildren = category.children.length > 1;

          return (
            <div key={category.key} className="border rounded-lg p-3 bg-card">
              {/* Category header */}
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id={`cat-${category.key}`}
                  checked={indeterminate ? 'indeterminate' : allChecked}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggleCategory(category.key, !!checked)}
                />
                <Label
                  htmlFor={`cat-${category.key}`}
                  className="text-sm font-semibold cursor-pointer"
                >
                  {category.label}
                </Label>
                {!allChecked && !indeterminate && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Ẩn</Badge>
                )}
              </div>

              {/* Children - only show if category has multiple items */}
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
                        <Label
                          htmlFor={`perm-${child.key}`}
                          className="text-xs cursor-pointer leading-tight"
                        >
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
