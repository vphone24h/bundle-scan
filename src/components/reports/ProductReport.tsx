import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductSalesStockReport } from './ProductSalesStockReport';
import { ProductImportExportReport } from './ProductImportExportReport';

export function ProductReport() {
  return (
    <Tabs defaultValue="sales" className="space-y-4">
      <TabsList>
        <TabsTrigger value="sales">Bán hàng & Tồn kho</TabsTrigger>
        <TabsTrigger value="import-export">Nhập – Xuất</TabsTrigger>
      </TabsList>
      <TabsContent value="sales">
        <ProductSalesStockReport />
      </TabsContent>
      <TabsContent value="import-export">
        <ProductImportExportReport />
      </TabsContent>
    </Tabs>
  );
}
