import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, AlertTriangle, XCircle, TrendingUp, Wallet, EyeOff, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/usePermissions';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

interface InventoryStatsProps {
  totalProducts: number;
  totalStock: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue?: number;
}

export function InventoryStats({
  totalProducts,
  totalStock,
  lowStockItems,
  outOfStockItems,
  totalValue,
}: InventoryStatsProps) {
  const { t } = useTranslation();
  const { data: permissions } = usePermissions();
  const canViewImportPrice = permissions?.canViewInventoryImportPrice ?? false;
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('dashboard_profit');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const valueHidden = hasSecurityPassword && !unlocked;

  const stats = [
    {
      titleKey: 'pages.inventory.totalProducts',
      value: totalProducts.toLocaleString('vi-VN'),
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      hideForStaff: true,
      description: "Số dòng sản phẩm hiển thị trong bảng Tồn kho — đã gom theo Tên + SKU + Chi nhánh. Khác với 'Đang tồn kho' ở Trang chủ (đếm từng bản ghi: mỗi IMEI hoặc mỗi lô nhập = 1).",
    },
    {
      titleKey: 'pages.inventory.totalStock',
      value: totalStock.toLocaleString('vi-VN'),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      hideForStaff: true,
      description: "Tổng số lượng tồn kho thực tế (cộng tất cả số lượng còn lại của các sản phẩm).",
    },
    {
      titleKey: 'pages.inventory.stockValue',
      value: valueHidden ? '••••••' : (totalValue !== undefined ? `${totalValue.toLocaleString('vi-VN')} đ` : '0 đ'),
      icon: valueHidden ? EyeOff : Wallet,
      color: valueHidden ? 'text-muted-foreground' : 'text-blue-600',
      bgColor: valueHidden ? 'bg-muted' : 'bg-blue-100',
      isLarge: true,
      hideForStaff: true,
      onClick: valueHidden ? () => setShowPasswordDialog(true) : undefined,
    },
    {
      titleKey: 'pages.inventory.lowStock',
      value: lowStockItems.toLocaleString('vi-VN'),
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: "Sản phẩm còn 1-2 cái — cần nhập thêm sớm.",
    },
    {
      titleKey: 'pages.inventory.outOfStock',
      value: outOfStockItems.toLocaleString('vi-VN'),
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      description: "Sản phẩm đã hết hàng (số lượng = 0).",
    },
  ];

  return (
    <>
      <SecurityPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={unlock}
        title="Xem giá trị kho"
        description="Nhập mật khẩu bảo mật để xem giá trị kho"
      />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {stats.filter(stat => !(stat.hideForStaff && !canViewImportPrice)).map((stat) => (
          <Card
            key={stat.titleKey}
            className={stat.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
            onClick={stat.onClick}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`rounded-lg p-2 sm:p-3 ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{t(stat.titleKey)}</p>
                    {stat.description && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label="Mô tả"
                          >
                            <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                          {stat.description}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className={`font-bold truncate ${stat.isLarge ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
