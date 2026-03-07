import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/mockData';
import { Package, DollarSign, Archive, ShoppingCart, EyeOff, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

interface ImportInventorySummaryProps {
  isFiltered?: boolean;
  /** When filtered, pass products to calculate from client-side */
  filteredProducts?: Array<{
    status: string;
    total_import_cost: number;
    import_price: number;
    quantity: number;
  }>;
}

function useImportSummaryStats() {
  const { user } = useAuth();
  const { branchId, shouldFilter } = useBranchFilter();

  return useQuery({
    queryKey: ['import-summary-stats', user?.id, branchId],
    queryFn: async () => {
      const tenantId = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId.data) throw new Error('No tenant');

      const { data, error } = await supabase.rpc('get_import_summary_stats', {
        _tenant_id: tenantId.data,
        _branch_id: shouldFilter && branchId ? branchId : null,
      });
      if (error) throw error;
      return data as Record<string, number>;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function ImportInventorySummary({ isFiltered = false, filteredProducts }: ImportInventorySummaryProps) {
  const { t } = useTranslation();
  const { data: serverStats, isLoading } = useImportSummaryStats();

  const stats = useMemo(() => {
    // If filtered, calculate from filtered products
    if (isFiltered && filteredProducts) {
      const getVal = (p: any) => Number(p.total_import_cost || (Number(p.import_price) * (p.quantity || 1)));
      const totalImportValue = filteredProducts.reduce((sum, p) => sum + getVal(p), 0);
      const totalQuantity = filteredProducts.reduce((sum, p) => sum + (p.quantity || 1), 0);
      const inStock = filteredProducts.filter(p => p.status === 'in_stock');
      const sold = filteredProducts.filter(p => p.status === 'sold');
      const returned = filteredProducts.filter(p => p.status === 'returned');
      return {
        totalImportValue,
        totalQuantity,
        inStockValue: inStock.reduce((sum, p) => sum + getVal(p), 0),
        inStockQuantity: inStock.reduce((sum, p) => sum + (p.quantity || 1), 0),
        soldValue: sold.reduce((sum, p) => sum + getVal(p), 0),
        soldQuantity: sold.reduce((sum, p) => sum + (p.quantity || 1), 0),
        returnedValue: returned.reduce((sum, p) => sum + getVal(p), 0),
        returnedQuantity: returned.reduce((sum, p) => sum + (p.quantity || 1), 0),
      };
    }

    // Use server-side stats
    if (!serverStats) return null;
    return {
      totalImportValue: Number(serverStats.totalImportValue || 0),
      totalQuantity: Number(serverStats.totalQuantity || 0),
      inStockValue: Number(serverStats.inStockValue || 0),
      inStockQuantity: Number(serverStats.inStockQuantity || 0),
      soldValue: Number(serverStats.soldValue || 0),
      soldQuantity: Number(serverStats.soldQuantity || 0),
      returnedValue: Number(serverStats.returnedValue || 0),
      returnedQuantity: Number(serverStats.returnedQuantity || 0),
    };
  }, [isFiltered, filteredProducts, serverStats]);

  if (!stats && isLoading) return null;
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{isFiltered ? t('importSummary.totalImportValueFiltered') : t('importSummary.totalImportValue')}</p>
              <p className="text-lg font-bold text-primary truncate">{formatCurrency(stats.totalImportValue)}</p>
              <p className="text-xs text-muted-foreground">{stats.totalQuantity} {t('importSummary.products')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20"><Archive className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{t('importSummary.inStockValue')}</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400 truncate">{formatCurrency(stats.inStockValue)}</p>
              <p className="text-xs text-muted-foreground">{stats.inStockQuantity} {t('importSummary.products')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20"><ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{t('importSummary.soldValue')}</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400 truncate">{formatCurrency(stats.soldValue)}</p>
              <p className="text-xs text-muted-foreground">{stats.soldQuantity} {t('importSummary.products')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20"><Package className="h-5 w-5 text-orange-600 dark:text-orange-400" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{t('importSummary.returnedValue')}</p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400 truncate">{formatCurrency(stats.returnedValue)}</p>
              <p className="text-xs text-muted-foreground">{stats.returnedQuantity} {t('importSummary.products')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
