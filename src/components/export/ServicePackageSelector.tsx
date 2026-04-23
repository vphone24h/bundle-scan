import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Info } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import {
  useProductServicePackages,
  type ProductServicePackage,
} from '@/hooks/useProductServicePackages';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface SelectedServicePackage {
  package_id: string;
  package_name: string;
  price: number;
  quantity: number;
}

interface ServicePackageSelectorProps {
  productGroupId: string | null;
  selected: SelectedServicePackage[];
  onChange: (selected: SelectedServicePackage[]) => void;
}

export function ServicePackageSelector({
  productGroupId,
  selected,
  onChange,
}: ServicePackageSelectorProps) {
  const { data: packages = [] } = useProductServicePackages(productGroupId);

  if (!productGroupId || packages.length === 0) return null;

  const isSelected = (pkgId: string) => selected.some(s => s.package_id === pkgId);

  const togglePackage = (pkg: ProductServicePackage) => {
    if (isSelected(pkg.id)) {
      onChange(selected.filter(s => s.package_id !== pkg.id));
    } else {
      onChange([...selected, {
        package_id: pkg.id,
        package_name: pkg.name,
        price: pkg.price,
        quantity: 1,
      }]);
    }
  };

  const totalServiceAmount = selected.reduce((sum, s) => sum + s.price * s.quantity, 0);

  return (
    <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Gói dịch vụ</span>
        <Badge variant="secondary" className="text-[10px]">
          {packages.length} gói
        </Badge>
      </div>

      <div className="space-y-1.5">
        {packages.map((pkg) => (
          <label
            key={pkg.id}
            className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/40 transition-colors"
          >
            <Checkbox
              checked={isSelected(pkg.id)}
              onCheckedChange={() => togglePackage(pkg)}
            />
            <span className="text-sm flex-1 truncate">{pkg.name}</span>
            {pkg.description && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{pkg.description}</TooltipContent>
              </Tooltip>
            )}
            <span className="text-sm font-medium text-primary whitespace-nowrap">
              +{formatNumber(pkg.price)}đ
            </span>
          </label>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="pt-1.5 border-t text-xs flex justify-between">
          <span className="text-muted-foreground">Tổng gói dịch vụ:</span>
          <span className="font-medium text-primary">+{formatNumber(totalServiceAmount)}đ</span>
        </div>
      )}
    </div>
  );
}