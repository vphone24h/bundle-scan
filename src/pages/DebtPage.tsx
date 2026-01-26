import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CustomerDebtTable } from '@/components/debt/CustomerDebtTable';
import { SupplierDebtTable } from '@/components/debt/SupplierDebtTable';
import { Users, Truck } from 'lucide-react';

export default function DebtPage() {
  const [showSettled, setShowSettled] = useState(false);

  return (
    <MainLayout>
      <PageHeader
        title="Quản lý Công nợ"
        description="Theo dõi và quản lý công nợ khách hàng và nhà cung cấp"
      />

      <div className="space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-lg">
          <Checkbox
            id="showSettled"
            checked={showSettled}
            onCheckedChange={(checked) => setShowSettled(checked === true)}
          />
          <Label htmlFor="showSettled" className="text-sm cursor-pointer">
            Hiện cả đối tượng đã trả hết nợ
          </Label>
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
            <CustomerDebtTable showSettled={showSettled} />
          </TabsContent>

          <TabsContent value="supplier" className="mt-4">
            <SupplierDebtTable showSettled={showSettled} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
