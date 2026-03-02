import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductSalesStockReport } from './ProductSalesStockReport';
import { ProductImportExportReport } from './ProductImportExportReport';

export function ProductReport() {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="sales" className="space-y-4">
      <TabsList>
        <TabsTrigger value="sales">{t('pages.reports.salesStock')}</TabsTrigger>
        <TabsTrigger value="import-export">{t('pages.reports.importExport')}</TabsTrigger>
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