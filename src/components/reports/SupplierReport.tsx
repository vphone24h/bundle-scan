import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Factory, RotateCcw } from 'lucide-react';
import { SupplierImportReport } from './SupplierImportReport';
import { SupplierReturnReport } from './SupplierReturnReport';

export function SupplierReport() {
  const [activeTab, setActiveTab] = useState('import');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="import" className="gap-1.5">
            <Factory className="h-4 w-4" />
            Nhập hàng & Công nợ
          </TabsTrigger>
          <TabsTrigger value="returns" className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Trả hàng NCC
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-4">
          <SupplierImportReport />
        </TabsContent>
        <TabsContent value="returns" className="mt-4">
          <SupplierReturnReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
