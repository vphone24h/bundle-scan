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
        { section: 'products', label: 'Sản phẩm & nhóm SP' },
        { section: 'import_receipts', label: 'Phiếu nhập & thanh toán' },
        { section: 'export_receipts', label: 'Phiếu xuất' },
        { section: 'export_child_records', label: 'Chi tiết phiếu xuất' },
        { section: 'returns', label: 'Trả hàng' },
        { section: 'stock', label: 'Kiểm kho & chuyển kho' },
        { section: 'imei_histories', label: 'Lịch sử IMEI' },
        { section: 'cash_debt', label: 'Sổ quỹ & công nợ' },
        { section: 'crm', label: 'CRM & chăm sóc KH' },
        { section: 'staff', label: 'Nhân viên & KPI' },
        { section: 'settings', label: 'Cài đặt & cấu hình' },
        { section: 'landing', label: 'Landing page' },
        { section: 'shop_ctv', label: 'CTV & cộng tác viên' },
        { section: 'email_zalo', label: 'Email & Zalo' },
        { section: 'einvoices', label: 'Hóa đơn điện tử' },
        { section: 'misc', label: 'Dữ liệu khác' },
        { section: 'web_config', label: 'Cấu hình web' },
        { section: 'finalize', label: 'Hoàn tất' },
      ];

      const rawData: any = {};
      const totalSteps = EXPORT_STEPS.length;

      for (let i = 0; i < EXPORT_STEPS.length; i++) {
        const step = EXPORT_STEPS[i];
        setExportStatus(`Đang tải: ${step.label} (${i + 1}/${totalSteps})...`);
        setExportProgress(Math.round(((i) / totalSteps) * 100));

        let body: any = undefined;
        if (step.section === 'export_child_records') {
          const receiptIds = (rawData.export_receipts || []).map((r: any) => r.id);
          body = { parentIds: receiptIds };
        } else if (step.section === 'imei_histories') {
          const productIds = (rawData.products || []).map((p: any) => p.id);
          body = { parentIds: productIds };
        } else if (step.section === 'crm') {
          const customerIds = (rawData.customers || []).map((c: any) => c.id);
          body = { parentIds: customerIds };
        }

        const data = await invokeBackupSection(step.section, body);
        Object.assign(rawData, data);
      }

      setExportStatus('Đang tạo file...');
      setExportProgress(95);

      // Build the full backup JSON with ALL raw data
      const tenant = rawData.tenant;
      const exportJson = {
        version: '3.0',
        exported_at: new Date().toISOString(),
        tenant_name: tenant?.store_name || tenant?.business_name || '',
        // Raw data - keep all fields for full restore
        tenant,
        branches: rawData.branches || [],
        categories: rawData.categories || [],
        suppliers: rawData.suppliers || [],
        customers: rawData.customers || [],
        products: rawData.products || [],
        product_groups: rawData.product_groups || [],
        import_receipts: rawData.import_receipts || [],
        receipt_payments: rawData.receipt_payments || [],
        product_imports: rawData.product_imports || [],
        export_receipts: rawData.export_receipts || [],
        export_receipt_items: rawData.export_receipt_items || [],
        export_receipt_payments: rawData.export_receipt_payments || [],
        export_returns: rawData.export_returns || [],
        import_returns: rawData.import_returns || [],
        return_payments: rawData.return_payments || [],
        stock_counts: rawData.stock_counts || [],
        stock_count_items: rawData.stock_count_items || [],
        stock_transfer_requests: rawData.stock_transfer_requests || [],
        stock_transfer_items: rawData.stock_transfer_items || [],
        imei_histories: rawData.imei_histories || [],
        cash_book: rawData.cash_book || [],
        cash_book_opening_balances: rawData.cash_book_opening_balances || [],
        debt_payments: rawData.debt_payments || [],
        debt_offsets: rawData.debt_offsets || [],
        debt_settings: rawData.debt_settings || [],
        debt_tags: rawData.debt_tags || [],
        debt_tag_assignments: rawData.debt_tag_assignments || [],
        customer_care_schedules: rawData.customer_care_schedules || [],
        customer_care_logs: rawData.customer_care_logs || [],
        care_reminders: rawData.care_reminders || [],
        care_schedule_types: rawData.care_schedule_types || [],
        customer_tags: rawData.customer_tags || [],
        customer_tag_assignments: rawData.customer_tag_assignments || [],
        customer_sources: rawData.customer_sources || [],
        customer_contact_channels: rawData.customer_contact_channels || [],
        customer_vouchers: rawData.customer_vouchers || [],
        point_settings: rawData.point_settings || [],
        point_transactions: rawData.point_transactions || [],
        membership_tier_settings: rawData.membership_tier_settings || [],
        crm_notifications: rawData.crm_notifications || [],
        staff_reviews: rawData.staff_reviews || [],
        staff_kpi_settings: rawData.staff_kpi_settings || [],
        staff_performance_snapshots: rawData.staff_performance_snapshots || [],
        custom_payment_sources: rawData.custom_payment_sources || [],
        invoice_templates: rawData.invoice_templates || [],
        voucher_templates: rawData.voucher_templates || [],
        einvoice_configs: rawData.einvoice_configs || [],
        einvoices: rawData.einvoices || [],
        einvoice_items: rawData.einvoice_items || [],
        einvoice_logs: rawData.einvoice_logs || [],
        notification_automations: rawData.notification_automations || [],
        custom_domains: rawData.custom_domains || [],
        user_branch_access: rawData.user_branch_access || [],
        user_roles_backup: rawData.user_roles_backup || [],
        security_passwords: rawData.security_passwords || [],
        
        landing_products: rawData.landing_products || [],
        landing_product_categories: rawData.landing_product_categories || [],
        landing_orders: rawData.landing_orders || [],
        landing_articles: rawData.landing_articles || [],
        landing_article_categories: rawData.landing_article_categories || [],
        landing_product_blocked_dates: rawData.landing_product_blocked_dates || [],
        landing_order_email_logs: rawData.landing_order_email_logs || [],
        shop_collaborators: rawData.shop_collaborators || [],
        shop_ctv_orders: rawData.shop_ctv_orders || [],
        shop_ctv_settings: rawData.shop_ctv_settings || [],
        shop_ctv_withdrawals: rawData.shop_ctv_withdrawals || [],
        
        email_automations: rawData.email_automations || [],
        email_automation_blocks: rawData.email_automation_blocks || [],
        zalo_message_logs: rawData.zalo_message_logs || [],
        zalo_oa_followers: rawData.zalo_oa_followers || [],
        warehouse_value_snapshots: rawData.warehouse_value_snapshots || [],
        onboarding_tours: rawData.onboarding_tours || [],
        web_config: rawData.web_config,
        _metadata: {
          total_tables: 60,
          total_suppliers: (rawData.suppliers || []).length,
          total_customers: (rawData.customers || []).length,
          total_categories: (rawData.categories || []).length,
          total_branches: (rawData.branches || []).length,
          total_products: (rawData.products || []).length,
          total_import_receipts: (rawData.import_receipts || []).length,
          total_export_receipts: (rawData.export_receipts || []).length,
          total_export_receipt_items: (rawData.export_receipt_items || []).length,
          total_cash_book: (rawData.cash_book || []).length,
          total_debt_payments: (rawData.debt_payments || []).length,
          total_imei_histories: (rawData.imei_histories || []).length,
          total_export_returns: (rawData.export_returns || []).length,
          total_import_returns: (rawData.import_returns || []).length,
          total_stock_counts: (rawData.stock_counts || []).length,
          total_customer_care: (rawData.customer_care_schedules || []).length,
          total_point_transactions: (rawData.point_transactions || []).length,
          total_landing_products: (rawData.landing_products || []).length,
          total_landing_orders: (rawData.landing_orders || []).length,
          total_einvoices: (rawData.einvoices || []).length,
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
      const totalRecords = Object.entries(exportJson).filter(([k]) => Array.isArray(exportJson[k as keyof typeof exportJson])).reduce((sum, [, v]) => sum + (v as any[]).length, 0);
      toast.success(`Sao lưu hoàn tất! ${totalRecords.toLocaleString()} bản ghi từ ${meta.total_tables} bảng dữ liệu`);
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
        if (!data.version || !['1.0', '2.0', '3.0'].includes(data.version)) {
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
