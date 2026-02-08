import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerDebtTable } from '@/components/debt/CustomerDebtTable';
import { SupplierDebtTable } from '@/components/debt/SupplierDebtTable';
import { useCustomerDebts, useSupplierDebts } from '@/hooks/useDebt';
import { useBranches } from '@/hooks/useBranches';
import { usePermissions } from '@/hooks/usePermissions';
import { formatNumber } from '@/lib/formatNumber';
import { Users, Truck, TrendingUp, TrendingDown, Building2 } from 'lucide-react';

export default function DebtPage() {
  const [showSettled, setShowSettled] = useState(false);
  const [branchFilter, setBranchFilter] = useState('_all_');
  
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const isSuperAdmin = permissions?.canViewAllBranches === true;
  
  // Auto-lock branch filter for non-super-admins
  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setBranchFilter(permissions.branchId);
    }
  }, [isSuperAdmin, permissions?.branchId]);
  
  // Fetch debt data for summary
  const { data: customerDebts } = useCustomerDebts(false);
  const { data: supplierDebts } = useSupplierDebts(false);
  
  // Filter debts by selected branch
  const filteredCustomerDebts = useMemo(() => {
    if (!customerDebts) return [];
    if (branchFilter === '_all_') return customerDebts;
    return customerDebts.filter(d => d.branch_id === branchFilter);
  }, [customerDebts, branchFilter]);

  const filteredSupplierDebts = useMemo(() => {
    if (!supplierDebts) return [];
    if (branchFilter === '_all_') return supplierDebts;
    return supplierDebts.filter(d => d.branch_id === branchFilter);
  }, [supplierDebts, branchFilter]);
  
  // Calculate totals from filtered data
  const totalCustomerDebt = filteredCustomerDebts.reduce((sum, d) => sum + d.remaining_amount, 0);
  const totalSupplierDebt = filteredSupplierDebts.reduce((sum, d) => sum + d.remaining_amount, 0);

  return (
    <MainLayout>
      <PageHeader
        title="Quản lý Công nợ"
        description="Theo dõi và quản lý công nợ khách hàng và nhà cung cấp"
      />

      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-sm text-muted-foreground">Khách nợ mình</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-green-600">
                {formatNumber(totalCustomerDebt)}đ
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-sm text-muted-foreground">Mình nợ NCC</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-destructive">
                {formatNumber(totalSupplierDebt)}đ
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-muted/50 p-3 rounded-lg">
          {isSuperAdmin && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[140px] sm:w-[180px] h-9 text-xs sm:text-sm">
                <Building2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <SelectValue placeholder="Chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Tất cả chi nhánh</SelectItem>
                {branches?.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2">
            <Checkbox
              id="showSettled"
              checked={showSettled}
              onCheckedChange={(checked) => setShowSettled(checked === true)}
            />
            <Label htmlFor="showSettled" className="text-sm cursor-pointer">
              Hiện cả đối tượng đã trả hết nợ
            </Label>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="customer" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="customer" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Khách hàng nợ mình</span>
              <span className="sm:hidden">KH nợ mình</span>
            </TabsTrigger>
            <TabsTrigger value="supplier" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Mình nợ NCC</span>
              <span className="sm:hidden">Nợ NCC</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customer" className="mt-4">
            <CustomerDebtTable showSettled={showSettled} branchFilter={branchFilter} />
          </TabsContent>

          <TabsContent value="supplier" className="mt-4">
            <SupplierDebtTable showSettled={showSettled} branchFilter={branchFilter} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
