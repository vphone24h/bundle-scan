import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { 
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, 
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  ArrowDownToLine, ArrowUpFromLine, Loader2, CheckCircle2, AlertTriangle, 
  RefreshCw, FileJson, Shield, XCircle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LABEL_MAP: Record<string, string> = {
  branches: 'Chi nhánh',
  categories: 'Danh mục',
  suppliers: 'Nhà cung cấp',
  customers: 'Khách hàng',
  products: 'Sản phẩm',
  import_receipts: 'Phiếu nhập',
  export_receipts: 'Phiếu xuất',
  export_receipt_items: 'Chi tiết PX',
  export_receipt_payments: 'Thanh toán PX',
  cash_book: 'Sổ quỹ',
  debt_payments: 'Thanh toán nợ',
  web_config: 'Cấu hình web',
};

type ImportStat = { total: number; success: number; skipped: number; error: number };
type ImportStats = Record<string, ImportStat>;

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const normalizeStats = (stats: any): ImportStats => {
  if (!stats || typeof stats !== 'object') return {};
  const result: ImportStats = {};
  for (const [key, value] of Object.entries(stats)) {
    const s = value as any;
    result[key] = {
      total: toNumber(s?.total),
      success: toNumber(s?.success),
      skipped: toNumber(s?.skipped),
      error: toNumber(s?.error),
    };
  }
  return result;
};

const buildSummaryFromStats = (stats: ImportStats) => ({
  total_records: Object.values(stats).reduce((a, s) => a + s.total, 0),
  total_success: Object.values(stats).reduce((a, s) => a + s.success, 0),
  total_skipped: Object.values(stats).reduce((a, s) => a + s.skipped, 0),
  total_failed: Object.values(stats).reduce((a, s) => a + s.error, 0),
});

const normalizeImportResponse = (raw: any) => {
  const stats = normalizeStats(raw?.stats);
  const summary = raw?.summary
    ? {
        total_records: toNumber(raw.summary.total_records),
        total_success: toNumber(raw.summary.total_success),
        total_skipped: toNumber(raw.summary.total_skipped),
        total_failed: toNumber(raw.summary.total_failed),
      }
    : buildSummaryFromStats(stats);

  const normalizedErrors = Array.isArray(raw?.errors)
    ? raw.errors.filter((x: unknown) => typeof x === 'string')
    : [];

  return {
    ...raw,
    stats,
    summary,
    errors: normalizedErrors,
    total_errors: toNumber(raw?.total_errors, normalizedErrors.length),
  };
};

type ImportSectionKey =
  | 'branches'
  | 'categories'
  | 'suppliers'
  | 'customers'
  | 'products'
  | 'import_receipts'
  | 'export_receipts'
  | 'export_receipt_items'
  | 'export_receipt_payments'
  | 'cash_book'
  | 'debt_payments'
  | 'web_config';

type ImportStage = {
  label: string;
  sections: ImportSectionKey[];
};

const IMPORT_STAGES: ImportStage[] = [
  { label: 'Nền tảng', sections: ['branches', 'categories', 'suppliers'] },
  { label: 'Khách hàng', sections: ['customers'] },
  { label: 'Sản phẩm', sections: ['products'] },
  { label: 'Phiếu nhập/xuất', sections: ['import_receipts', 'export_receipts'] },
  { label: 'Chi tiết & thanh toán phiếu xuất', sections: ['export_receipt_items', 'export_receipt_payments'] },
  { label: 'Sổ quỹ & công nợ', sections: ['cash_book', 'debt_payments'] },
  { label: 'Cấu hình web', sections: ['web_config'] },
];

const CHUNK_SIZE = 150; // Items per chunk to avoid timeout
const MAX_RETRIES = 3;

const sectionHasData = (importData: any, section: ImportSectionKey) => {
  if (section === 'web_config') return !!importData?.web_config;
  return Array.isArray(importData?.[section]) && importData[section].length > 0;
};

const mergeImportResponses = (responses: any[]) => {
  const mergedStats: ImportStats = {};
  const mergedErrors: string[] = [];

  for (const response of responses) {
    const normalized = normalizeImportResponse(response);
    for (const [key, stat] of Object.entries(normalized.stats || {})) {
      const next = stat as ImportStat;
      if (!mergedStats[key]) {
        mergedStats[key] = { total: 0, success: 0, skipped: 0, error: 0 };
      }
      mergedStats[key].total += toNumber(next.total);
      mergedStats[key].success += toNumber(next.success);
      mergedStats[key].skipped += toNumber(next.skipped);
      mergedStats[key].error += toNumber(next.error);
    }

    if (Array.isArray(normalized.errors)) {
      mergedErrors.push(...normalized.errors);
    }
  }

  return {
    stats: mergedStats,
    summary: buildSummaryFromStats(mergedStats),
    errors: mergedErrors.slice(0, 200),
    total_errors: mergedErrors.length,
  };
};

/** Split large arrays in importData into chunks for a given stage */
function buildChunkedPayloads(importData: any, stage: ImportStage): any[] {
  // Collect all section arrays for this stage
  const sectionArrays: { key: ImportSectionKey; items: any[] }[] = [];
  let totalItems = 0;

  for (const section of stage.sections) {
    if (section === 'web_config') continue; // web_config is not an array
    if (Array.isArray(importData?.[section]) && importData[section].length > 0) {
      sectionArrays.push({ key: section, items: importData[section] });
      totalItems += importData[section].length;
    }
  }

  // If small enough or no arrays, send as single payload
  if (totalItems <= CHUNK_SIZE) {
    return [importData]; // single payload with full data
  }

  // Find the largest section to chunk
  const largestSection = sectionArrays.reduce((a, b) => a.items.length > b.items.length ? a : b);
  
  if (largestSection.items.length <= CHUNK_SIZE) {
    return [importData]; // no section large enough to chunk
  }

  // Chunk the largest section, keep others only in first chunk
  const chunks: any[] = [];
  const arr = largestSection.items;
  
  for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
    const slice = arr.slice(i, i + CHUNK_SIZE);
    const payload: any = {
      ...importData,
      [largestSection.key]: slice,
    };
    
    // For subsequent chunks, remove other section data (already imported in first chunk)
    if (i > 0) {
      for (const sa of sectionArrays) {
        if (sa.key !== largestSection.key) {
          payload[sa.key] = [];
        }
      }
    }
    
    chunks.push(payload);
  }

  return chunks;
}

async function invokeWithRetry(
  importData: any,
  mode: string,
  sections: ImportSectionKey[],
  retries = MAX_RETRIES,
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('cross-platform-restore', {
        body: { importData, mode, sections },
      });

      if (error) {
        const msg = error.message || '';
        const isTimeout = /(Failed to send a request|non-2xx status code|CPU Time exceeded|AbortError|timeout)/i.test(msg);
        if (isTimeout && attempt < retries) {
          console.warn(`Retry ${attempt}/${retries} for sections ${sections.join(',')}:`, msg);
          await new Promise(r => setTimeout(r, 2000 * attempt));
          continue;
        }
        throw error;
      }

      if (data?.error) throw new Error(data.error);
      return data;
    } catch (err) {
      if (attempt >= retries) throw err;
      const msg = (err as Error).message || '';
      const isTimeout = /(Failed to send a request|non-2xx status code|CPU Time exceeded|AbortError|timeout)/i.test(msg);
      if (!isTimeout) throw err;
      console.warn(`Retry ${attempt}/${retries}:`, msg);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

export function CrossPlatformBackupSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [importFile, setImportFile] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const invokeBackupSection = async (section: string, body?: any, retries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('cross-platform-backup', {
          body: { section, ...body },
        });
        if (error) {
          const msg = error.message || '';
          const isTimeout = /(Failed to send|non-2xx|CPU Time|AbortError|timeout)/i.test(msg);
          if (isTimeout && attempt < retries) {
            await new Promise(r => setTimeout(r, 2000 * attempt));
            continue;
          }
          throw error;
        }
        if (data?.error) throw new Error(data.error);
        return data;
      } catch (err) {
        if (attempt >= retries) throw err;
        const msg = (err as Error).message || '';
        if (!/(Failed to send|non-2xx|CPU Time|AbortError|timeout)/i.test(msg)) throw err;
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Đang tải thông tin cửa hàng...');
    try {
      const EXPORT_STEPS = [
        { section: 'init', label: 'Cửa hàng, chi nhánh, danh mục' },
        { section: 'suppliers', label: 'Nhà cung cấp' },
        { section: 'customers', label: 'Khách hàng' },
        { section: 'products', label: 'Sản phẩm' },
        { section: 'import_receipts', label: 'Phiếu nhập' },
        { section: 'export_receipts', label: 'Phiếu xuất' },
        { section: 'export_child_records', label: 'Chi tiết phiếu xuất' },
        { section: 'imei_histories', label: 'Lịch sử IMEI' },
        { section: 'cash_debt', label: 'Sổ quỹ & công nợ' },
        { section: 'web_config', label: 'Cấu hình web' },
        { section: 'finalize', label: 'Hoàn tất' },
      ];

      const rawData: any = {};
      const totalSteps = EXPORT_STEPS.length;

      for (let i = 0; i < EXPORT_STEPS.length; i++) {
        const step = EXPORT_STEPS[i];
        setExportStatus(`Đang tải: ${step.label}...`);
        setExportProgress(Math.round(((i) / totalSteps) * 100));

        let body: any = undefined;
        if (step.section === 'export_child_records') {
          const receiptIds = (rawData.export_receipts || []).map((r: any) => r.id);
          body = { parentIds: receiptIds };
        } else if (step.section === 'imei_histories') {
          const productIds = (rawData.products || []).map((p: any) => p.id);
          body = { parentIds: productIds };
        }

        const data = await invokeBackupSection(step.section, body);
        Object.assign(rawData, data);
      }

      setExportStatus('Đang tạo file...');
      setExportProgress(95);

      // Build ID maps
      const supplierIdMap: Record<string, string> = {};
      const customerIdMap: Record<string, string> = {};
      const categoryIdMap: Record<string, string> = {};
      const branchIdMap: Record<string, string> = {};
      const productIdMap: Record<string, string> = {};
      const importReceiptIdMap: Record<string, string> = {};
      const exportReceiptIdMap: Record<string, string> = {};

      const suppliers = rawData.suppliers || [];
      const customers = rawData.customers || [];
      const categories = rawData.categories || [];
      const branches = rawData.branches || [];
      const products = rawData.products || [];
      const importReceipts = rawData.import_receipts || [];
      const exportReceipts = rawData.export_receipts || [];
      const exportReceiptItems = rawData.export_receipt_items || [];
      const exportReceiptPayments = rawData.export_receipt_payments || [];
      const cashBook = rawData.cash_book || [];
      const debtPayments = rawData.debt_payments || [];
      const imeiHistories = rawData.imei_histories || [];
      const tenant = rawData.tenant;
      const webConfig = rawData.web_config;

      suppliers.forEach((s: any, i: number) => { supplierIdMap[s.id] = `sup_${String(i + 1).padStart(4, '0')}`; });
      customers.forEach((c: any, i: number) => { customerIdMap[c.id] = `cus_${String(i + 1).padStart(4, '0')}`; });
      categories.forEach((c: any, i: number) => { categoryIdMap[c.id] = `cat_${String(i + 1).padStart(4, '0')}`; });
      branches.forEach((b: any, i: number) => { branchIdMap[b.id] = `br_${String(i + 1).padStart(4, '0')}`; });
      products.forEach((p: any, i: number) => { productIdMap[p.id] = `prod_${String(i + 1).padStart(4, '0')}`; });
      importReceipts.forEach((r: any, i: number) => { importReceiptIdMap[r.id] = `imp_${String(i + 1).padStart(4, '0')}`; });
      exportReceipts.forEach((r: any, i: number) => { exportReceiptIdMap[r.id] = `exp_${String(i + 1).padStart(4, '0')}`; });

      const mapRef = (id: string | null, map: Record<string, string>) => id ? (map[id] || null) : null;

      const exportJson = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        tenant_name: tenant?.store_name || tenant?.business_name || '',
        tenant: tenant ? { store_name: tenant.store_name, business_name: tenant.business_name, business_type: tenant.business_type, phone: tenant.phone, address: tenant.address, logo_url: tenant.logo_url } : null,
        branches: branches.map((b: any) => ({ external_id: branchIdMap[b.id], name: b.name, address: b.address, phone: b.phone, is_default: b.is_default, note: b.note, created_at: b.created_at })),
        categories: categories.map((c: any) => ({ external_id: categoryIdMap[c.id], name: c.name, parent_external_id: mapRef(c.parent_id, categoryIdMap), created_at: c.created_at })),
        suppliers: suppliers.map((s: any) => ({ external_id: supplierIdMap[s.id], name: s.name, phone: s.phone, email: s.email, address: s.address, tax_code: s.tax_code, debt_amount: s.debt_amount, note: s.note, entity_code: s.entity_code, created_at: s.created_at })),
        customers: customers.map((c: any) => ({ external_id: customerIdMap[c.id], name: c.name, phone: c.phone, email: c.email, address: c.address, birthday: c.birthday, entity_code: c.entity_code, source: c.source, note: c.note, total_spent: c.total_spent, current_points: c.current_points, pending_points: c.pending_points, total_points_earned: c.total_points_earned, total_points_used: c.total_points_used, membership_tier: c.membership_tier, status: c.status, debt_due_days: c.debt_due_days, last_purchase_date: c.last_purchase_date, preferred_branch_external_id: mapRef(c.preferred_branch_id, branchIdMap), created_at: c.created_at })),
        products: products.map((p: any) => ({ external_id: productIdMap[p.id], name: p.name, sku: p.sku, imei: p.imei, barcode: p.barcode, import_price: p.import_price, sale_price: p.sale_price, quantity: p.quantity, status: p.status, warranty: p.warranty, warranty_package: p.warranty_package, warranty_start_date: p.warranty_start_date, warranty_end_date: p.warranty_end_date, note: p.note, image_url: p.image_url, supplier_name: p.supplier_name, supplier_external_id: mapRef(p.supplier_id, supplierIdMap), category_external_id: mapRef(p.category_id, categoryIdMap), branch_external_id: mapRef(p.branch_id, branchIdMap), group_id: p.group_id, version_name: p.version_name, version_value: p.version_value, color: p.color, created_at: p.created_at })),
        import_receipts: importReceipts.map((r: any) => ({ external_id: importReceiptIdMap[r.id], code: r.code, supplier_external_id: mapRef(r.supplier_id, supplierIdMap), branch_external_id: mapRef(r.branch_id, branchIdMap), total_amount: r.total_amount, paid_amount: r.paid_amount, payment_source: r.payment_source, import_date: r.import_date, note: r.note, status: r.status, created_at: r.created_at })),
        export_receipts: exportReceipts.map((r: any) => ({ external_id: exportReceiptIdMap[r.id], code: r.code, customer_external_id: mapRef(r.customer_id, customerIdMap), branch_external_id: mapRef(r.branch_id, branchIdMap), total_amount: r.total_amount, paid_amount: r.paid_amount, discount_amount: r.discount_amount, voucher_discount: r.voucher_discount, points_discount: r.points_discount, payment_source: r.payment_source, export_date: r.export_date, note: r.note, status: r.status, customer_name: r.customer_name, customer_phone: r.customer_phone, created_by_name: r.created_by_name, created_at: r.created_at })),
        export_receipt_items: exportReceiptItems.map((item: any) => ({ receipt_external_id: mapRef(item.receipt_id, exportReceiptIdMap), product_external_id: mapRef(item.product_id, productIdMap), product_name: item.product_name, imei: item.imei, quantity: item.quantity, unit_price: item.unit_price, total_price: item.total_price, warranty: item.warranty, warranty_package: item.warranty_package })),
        export_receipt_payments: exportReceiptPayments.map((p: any) => ({ receipt_external_id: mapRef(p.receipt_id, exportReceiptIdMap), amount: p.amount, payment_source: p.payment_source, payment_date: p.payment_date, note: p.note })),
        cash_book: cashBook.map((cb: any) => ({ type: cb.type, category: cb.category, description: cb.description, amount: cb.amount, payment_source: cb.payment_source, transaction_date: cb.transaction_date, note: cb.note, recipient_name: cb.recipient_name, recipient_phone: cb.recipient_phone, reference_type: cb.reference_type, is_business_accounting: cb.is_business_accounting, branch_external_id: mapRef(cb.branch_id, branchIdMap), created_by_name: cb.created_by_name, created_at: cb.created_at })),
        debt_payments: debtPayments.map((dp: any) => ({ entity_id: dp.entity_id, entity_type: dp.entity_type, payment_type: dp.payment_type, amount: dp.amount, allocated_amount: dp.allocated_amount, balance_after: dp.balance_after, description: dp.description, payment_source: dp.payment_source, branch_external_id: mapRef(dp.branch_id, branchIdMap), created_at: dp.created_at })),
        imei_histories: imeiHistories.map((h: any) => ({ product_external_id: mapRef(h.product_id, productIdMap), action: h.action, old_imei: h.old_imei, new_imei: h.new_imei, note: h.note, created_at: h.created_at })),
        web_config: webConfig ? { store_name: webConfig.store_name, store_description: webConfig.store_description, store_phone: webConfig.store_phone, store_email: webConfig.store_email, store_address: webConfig.store_address, additional_addresses: webConfig.additional_addresses, logo_url: webConfig.logo_url, banner_url: webConfig.banner_url, primary_color: webConfig.primary_color, secondary_color: webConfig.secondary_color, facebook_url: webConfig.facebook_url, zalo_url: webConfig.zalo_url, youtube_url: webConfig.youtube_url, tiktok_url: webConfig.tiktok_url, template_id: webConfig.template_id, custom_domain: webConfig.custom_domain } : null,
        _metadata: {
          total_suppliers: suppliers.length, total_customers: customers.length, total_categories: categories.length, total_branches: branches.length, total_products: products.length, total_import_receipts: importReceipts.length, total_export_receipts: exportReceipts.length, total_export_receipt_items: exportReceiptItems.length, total_cash_book: cashBook.length, total_debt_payments: debtPayments.length, total_imei_histories: imeiHistories.length,
        },
      };

      const jsonStr = JSON.stringify(exportJson, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `VKHO_backup_${exportJson.tenant_name || 'store'}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setExportStatus('Hoàn tất!');

      const meta = exportJson._metadata;
      toast.success(`Đã xuất: ${meta.total_products} SP, ${meta.total_customers} KH, ${meta.total_suppliers} NCC, ${meta.total_import_receipts} PN, ${meta.total_export_receipts} PX`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Lỗi xuất dữ liệu: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
      setTimeout(() => { setExportProgress(0); setExportStatus(''); }, 3000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { toast.error('Vui lòng chọn file JSON'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version || data.version !== '1.0') {
          toast.error('File không hợp lệ hoặc version không hỗ trợ');
          return;
        }
        setImportFile(data);
        setImportPreview(data._metadata || {});
        setShowImportDialog(true);
      } catch {
        toast.error('File JSON không hợp lệ');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = useCallback(async () => {
    if (!importFile) return;
    setShowConfirmDialog(false);
    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Đang chuẩn bị...');
    
    try {
      // Calculate total work units (chunks across all stages)
      const runnableStages = IMPORT_STAGES.filter((stage) =>
        stage.sections.some((section) => sectionHasData(importFile, section))
      );

      if (runnableStages.length === 0) {
        throw new Error('File không có dữ liệu để import');
      }

      // Pre-calculate all chunks for progress tracking
      const allWork: { stage: ImportStage; chunks: any[]; stageIndex: number }[] = [];
      let totalChunks = 0;

      for (let si = 0; si < runnableStages.length; si++) {
        const stage = runnableStages[si];
        const chunks = buildChunkedPayloads(importFile, stage);
        allWork.push({ stage, chunks, stageIndex: si });
        totalChunks += chunks.length;
      }

      const stageResponses: any[] = [];
      let completedChunks = 0;

      for (const { stage, chunks, stageIndex } of allWork) {
        for (let ci = 0; ci < chunks.length; ci++) {
          const chunkData = chunks[ci];
          const stageMode = stageIndex === 0 && ci === 0 ? importMode : 'merge';

          const chunkLabel = chunks.length > 1
            ? `${stage.label} (${ci + 1}/${chunks.length})`
            : stage.label;
          
          setImportStatus(`Đang xử lý: ${chunkLabel}...`);

          const data = await invokeWithRetry(chunkData, stageMode, stage.sections);
          stageResponses.push(data);

          completedChunks++;
          const pct = Math.round((completedChunks / totalChunks) * 100);
          setImportProgress(pct);
        }
      }

      const normalized = mergeImportResponses(stageResponses);
      setImportResult(normalized);
      setImportStatus('Hoàn tất!');
      setImportProgress(100);
      setShowResultDialog(true);
      setImportFile(null);
      setImportPreview(null);
      
      const s = normalized.summary;
      if (s) {
        const suppliers = normalized.stats?.suppliers || { total: 0, success: 0 };
        const customers = normalized.stats?.customers || { total: 0, success: 0 };
        const importOrders = normalized.stats?.import_receipts || { total: 0, success: 0 };
        const exportOrders = normalized.stats?.export_receipts || { total: 0, success: 0 };
        const totalOrders = importOrders.total + exportOrders.total;
        const successOrders = importOrders.success + exportOrders.success;
        const msg = `Import: ${s.total_success} OK, ${s.total_skipped} bỏ qua, ${s.total_failed} lỗi • NCC ${suppliers.success}/${suppliers.total}, KH ${customers.success}/${customers.total}, Đơn ${successOrders}/${totalOrders}`;
        if (s.total_failed > 0) toast.warning(msg);
        else toast.success(msg);
      }
    } catch (error) {
      console.error('Import error:', error);
      const rawMessage = (error as Error).message || 'Lỗi không xác định';
      const message = /(Failed to send a request to the Edge Function|Edge Function returned a non-2xx status code|CPU Time exceeded)/i.test(rawMessage)
        ? 'Import bị quá thời gian xử lý trên máy chủ. Vui lòng thử lại.'
        : rawMessage;
      setImportResult({
        stats: {},
        errors: [message],
        total_errors: 1,
        summary: {
          total_records: 0,
          total_success: 0,
          total_skipped: 0,
          total_failed: 1,
        },
      });
      setShowResultDialog(true);
      toast.error('Lỗi import: ' + message);
    } finally {
      setIsImporting(false);
    }
  }, [importFile, importMode]);

  return (
    <>
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700">
            <RefreshCw className="h-5 w-5" />
            Đồng bộ dữ liệu (Cross-platform)
          </CardTitle>
          <CardDescription>
            Xuất/nhập toàn bộ dữ liệu cửa hàng dưới dạng JSON chuẩn. Dùng để di chuyển dữ liệu giữa Cloud và VPS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-emerald-100/50 border border-emerald-200 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium text-emerald-800">
              <Shield className="h-4 w-4" />
              Tính năng chính
            </div>
            <ul className="list-disc list-inside text-emerald-700 space-y-0.5 ml-1 text-xs">
              <li>Sử dụng external_id thay vì UUID - tương thích mọi database</li>
              <li>Giữ nguyên liên kết: NCC ↔ Phiếu nhập, KH ↔ Phiếu xuất</li>
              <li>Tự động bỏ qua dữ liệu trùng (KH trùng SĐT, SP trùng SKU/IMEI)</li>
              <li>Version 1.0 - đảm bảo tương thích giữa các phiên bản</li>
            </ul>
          </div>

          {/* Progress bar during export */}
          {isExporting && (
            <div className="space-y-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-700 font-medium flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {exportStatus}
                </span>
                <span className="text-emerald-600 font-bold">{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
              <p className="text-xs text-emerald-600">
                Đang sao lưu từng phần, vui lòng không đóng trang...
              </p>
            </div>
          )}

          {/* Progress bar during import */}
          {isImporting && (
            <div className="space-y-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700 font-medium flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {importStatus}
                </span>
                <span className="text-blue-600 font-bold">{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
              <p className="text-xs text-blue-600">
                Đang chạy ngầm, vui lòng không đóng trang...
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleExport} disabled={isExporting || isImporting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {isExporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang xuất...</> : <><ArrowDownToLine className="h-4 w-4 mr-2" />Sao lưu (Export JSON)</>}
            </Button>
            <Button onClick={() => fileRef.current?.click()} disabled={isImporting || isExporting} variant="outline" className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              {isImporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang nhập {importProgress}%</> : <><ArrowUpFromLine className="h-4 w-4 mr-2" />Khôi phục (Import JSON)</>}
            </Button>
          </div>

          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
          <p className="text-xs text-muted-foreground text-center">💡 File JSON có thể import vào VKHO trên VPS hoặc Cloud khác</p>
        </CardContent>
      </Card>

      {/* Import Preview Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-emerald-600" />
              Xem trước dữ liệu Import
            </DialogTitle>
            <DialogDescription>Kiểm tra dữ liệu trước khi nhập vào hệ thống</DialogDescription>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Cửa hàng:</span>
                <span className="font-medium">{importFile?.tenant_name || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Xuất lúc:</span>
                <span className="font-medium">{importFile?.exported_at ? new Date(importFile.exported_at).toLocaleString('vi-VN') : 'N/A'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Chi nhánh', importPreview.total_branches],
                  ['Danh mục', importPreview.total_categories],
                  ['NCC', importPreview.total_suppliers],
                  ['Khách hàng', importPreview.total_customers],
                  ['Sản phẩm', importPreview.total_products],
                  ['Phiếu nhập', importPreview.total_import_receipts],
                  ['Phiếu xuất', importPreview.total_export_receipts],
                  ['Sổ quỹ', importPreview.total_cash_book],
                ].filter(([, v]) => (v as number) > 0).map(([label, count]) => (
                  <div key={label as string} className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">{label}</span>
                    <Badge variant="secondary">{count as number}</Badge>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Chế độ import:</Label>
                <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="merge" id="merge" className="mt-1" />
                    <div>
                      <Label htmlFor="merge" className="text-sm font-medium">Gộp dữ liệu</Label>
                      <p className="text-xs text-muted-foreground">Thêm mới, bỏ qua trùng (SĐT, SKU)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="overwrite" id="overwrite" className="mt-1" />
                    <div>
                      <Label htmlFor="overwrite" className="text-sm font-medium text-destructive">Ghi đè</Label>
                      <p className="text-xs text-muted-foreground">⚠️ Xoá dữ liệu cũ trước khi import</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Huỷ</Button>
            <Button onClick={() => { setShowImportDialog(false); setShowConfirmDialog(true); }} className="bg-emerald-600 hover:bg-emerald-700">
              Tiếp tục Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Xác nhận Import
            </AlertDialogTitle>
            <AlertDialogDescription>
              {importMode === 'overwrite' 
                ? 'Toàn bộ dữ liệu hiện tại sẽ bị XÓA và thay thế. Không thể hoàn tác!'
                : 'Dữ liệu mới sẽ được thêm vào. Bản ghi trùng SĐT/SKU sẽ được bỏ qua.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700">
              Xác nhận Import
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result Dialog - DETAILED */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importResult?.summary?.total_failed > 0 ? (
                <><AlertTriangle className="h-5 w-5 text-orange-500" />Kết quả Import (có lỗi)</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 text-emerald-600" />Import thành công!</>
              )}
            </DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-2xl font-bold text-emerald-700">{importResult.summary?.total_success || 0}</div>
                  <div className="text-xs text-emerald-600">Thành công</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">{importResult.summary?.total_skipped || 0}</div>
                  <div className="text-xs text-blue-600">Bỏ qua (trùng)</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-2xl font-bold text-red-700">{importResult.summary?.total_failed || 0}</div>
                  <div className="text-xs text-red-600">Lỗi</div>
                </div>
              </div>

              {/* Detailed stats per type */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-5 gap-1 text-xs font-medium text-muted-foreground px-2 pb-1 border-b">
                  <span className="col-span-2">Loại dữ liệu</span>
                  <span className="text-center">✅</span>
                  <span className="text-center">⏭️</span>
                  <span className="text-center">❌</span>
                </div>
                {Object.entries(importResult.stats || {}).map(([key, s]: [string, any]) => {
                  if (s.total === 0) return null;
                  return (
                    <div key={key} className="grid grid-cols-5 gap-1 text-sm px-2 py-1.5 rounded hover:bg-muted/50">
                      <span className="col-span-2 font-medium">{LABEL_MAP[key] || key}</span>
                      <span className="text-center text-emerald-700">{s.success}</span>
                      <span className="text-center text-blue-600">{s.skipped}</span>
                      <span className="text-center text-red-600">{s.error}</span>
                    </div>
                  );
                })}
              </div>

              {/* Error details */}
              {importResult.total_errors > 0 && (
                <div className="p-3 rounded border border-orange-200 bg-orange-50 text-sm">
                  <p className="font-medium text-orange-700 mb-1 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    Chi tiết lỗi ({importResult.total_errors})
                  </p>
                  <ul className="text-xs text-orange-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {(importResult.errors || []).map((err: string, i: number) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setShowResultDialog(false); setImportResult(null); }}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
