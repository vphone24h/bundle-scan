import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VariantLevel } from './VariantConfig';

export interface SelectedVariants {
  variant_1?: string;
  variant_2?: string;
  variant_3?: string;
}

interface VariantSelectorProps {
  levels: VariantLevel[];
  selected: SelectedVariants;
  onChange: (selected: SelectedVariants) => void;
  baseProductName: string;
}

export function VariantSelector({ levels, selected, onChange, baseProductName }: VariantSelectorProps) {
  const activeLevels = levels.filter(l => l.values.length > 0);

  if (activeLevels.length === 0) return null;

  const handleChange = (levelIndex: number, value: string) => {
    const key = `variant_${levelIndex + 1}` as keyof SelectedVariants;
    onChange({ ...selected, [key]: value === '_none_' ? undefined : value });
  };

  // Build display name
  const parts = [baseProductName];
  if (selected.variant_1) parts.push(selected.variant_1);
  if (selected.variant_2) parts.push(selected.variant_2);
  if (selected.variant_3) parts.push(selected.variant_3);
  const displayName = parts.join(' ');

  const allSelected = activeLevels.every((_, idx) => {
    const key = `variant_${idx + 1}` as keyof SelectedVariants;
    return !!selected[key];
  });

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Badge variant="default" className="text-xs">Biến thể</Badge>
        <span className="text-xs text-muted-foreground">Chọn biến thể để nhập hàng</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {activeLevels.map((level, idx) => {
          const key = `variant_${idx + 1}` as keyof SelectedVariants;
          return (
            <div key={idx}>
              <Label className="text-xs mb-1 block">{level.label}</Label>
              <Select
                value={selected[key] || '_none_'}
                onValueChange={(val) => handleChange(idx, val)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={`Chọn ${level.label}`} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">-- Chọn --</SelectItem>
                  {level.values.map((val) => (
                    <SelectItem key={val} value={val}>{val}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      {/* Generated name preview */}
      {allSelected && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">Tên sản phẩm sẽ là:</p>
          <p className="text-sm font-medium text-primary">{displayName}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Build the full product name from base name + selected variants
 */
export function buildVariantProductName(
  baseName: string,
  selected: SelectedVariants
): string {
  const parts = [baseName];
  if (selected.variant_1) parts.push(selected.variant_1);
  if (selected.variant_2) parts.push(selected.variant_2);
  if (selected.variant_3) parts.push(selected.variant_3);
  return parts.join(' ');
}
