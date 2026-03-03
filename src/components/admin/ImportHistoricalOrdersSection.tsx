import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'import-historical-orders-state';

interface PersistedState {
  importing: boolean;
  progress: number;
  fileName: string;
  results: ImportResult | null;
  startedAt: number | null;
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { importing: false, progress: 0, fileName: '', results: null, startedAt: null };
}

function savePersistedState(state: Partial<PersistedState>) {
  try {
    const current = loadPersistedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
  } catch {}
}

interface ParsedOrder {
  orderId: string;
  imei: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  productName: string;
  productVariant: string;
  salePrice: number;
  note: string;
  orderDate: string;
  status: string;
  warranty: string;
}

interface ImportResult {
  totalOrders: number;
  completedOrders: number;
  createdReceipts: number;
  createdItems: number;
  customersCreated: number;
  skipped: number;
}

function parseVPhoneRow(row: any[]): ParsedOrder | null {
  try {
    // Column 0: orderId + IMEI + Serial
    const col0 = String(row[0] || '');
    const lines0 = col0.split('\n').map((l: string) => l.trim());
    const orderId = lines0[0] || '';
    let imei = '';
    for (const line of lines0) {
      const match = line.match(/^IMEI:\s*(.*)$/i);
      if (match) {
        imei = match[1].trim();
        break;
      }
    }

    // Column 1: customerName + email + phone + address
    const col1 = String(row[1] || '');
    const lines1 = col1.split('\n').map((l: string) => l.trim());
    const customerName = lines1[0] || 'Khách lẻ';
    let customerPhone = '';
    let customerEmail = '';
    let customerAddress = '';
    for (const line of lines1) {
      if (/^0\d{8,10}$/.test(line.replace(/\s/g, ''))) {
        customerPhone = line.replace(/\s/g, '');
      } else if (line.includes('@')) {
        customerEmail = line;
      } else if (line !== customerName && line !== '' && !customerPhone) {
        // Could be address or other info
      }
    }
    // Last non-empty line that's not phone/email/name could be address
    for (let i = lines1.length - 1; i >= 1; i--) {
      const l = lines1[i];
      if (l && l !== customerPhone && !l.includes('@') && !/^0\d{8,10}$/.test(l.replace(/\s/g, ''))) {
        customerAddress = l;
        break;
      }
    }

    // Column 2: product info
    const col2 = String(row[2] || '');
    const lines2 = col2.split('\n').map((l: string) => l.trim());
    const productName = lines2[0] || 'Sản phẩm';
    const productVariant = lines2[1] || '';
    let note = '';
    let warranty = 'N/A';
    for (const line of lines2) {
      const noteMatch = line.match(/^Ghi chú:\s*(.*)$/i);
      if (noteMatch) note = noteMatch[1].trim();
      const warrantyMatch = line.match(/^Gói bảo hành:\s*(.*)$/i);
      if (warrantyMatch) warranty = warrantyMatch[1].trim();
    }

    // Column 4: price (numeric)
    let salePrice = 0;
    const col4 = row[4];
    if (typeof col4 === 'number') {
      salePrice = col4;
    } else {
      const priceStr = String(col4 || '').replace(/[^\d]/g, '');
      salePrice = parseInt(priceStr) || 0;
    }

    // Column 6: date + admin info
    const col6 = String(row[6] || '');
    const lines6 = col6.split('\n').map((l: string) => l.trim());
    let orderDate = '';
    for (const line of lines6) {
      // Match dd/MM/yyyy pattern
      const dateMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})$/);
      if (dateMatch) {
        orderDate = dateMatch[1];
        break;
      }
    }

    // Column 7: status
    const status = String(row[7] || '').trim();

    if (!orderId) return null;

    return {
      orderId,
      imei,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      productName: productName + (productVariant ? ` - ${productVariant}` : ''),
      productVariant,
      salePrice,
      note,
      orderDate,
      status,
      warranty: warranty === 'N/A' ? '' : warranty,
    };
  } catch {
    return null;
  }
}

const BATCH_SIZE = 500;

export function ImportHistoricalOrdersSection() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceId, setSourceId] = useState('backup');
  const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
  
  // Restore persisted state on mount
  const persisted = loadPersistedState();
  const [importing, setImporting] = useState(persisted.importing);
  const [progress, setProgress] = useState(persisted.progress);
  const [results, setResults] = useState<ImportResult | null>(persisted.results);
  const [fileName, setFileName] = useState(persisted.fileName);

  // Persist state changes
  const updateProgress = useCallback((value: number) => {
    setProgress(value);
    savePersistedState({ progress: value });
  }, []);

  const updateImporting = useCallback((value: boolean) => {
    setImporting(value);
    savePersistedState({ importing: value, startedAt: value ? Date.now() : null });
  }, []);

  const updateResults = useCallback((value: ImportResult | null) => {
    setResults(value);
    savePersistedState({ results: value, importing: false, progress: 100 });
  }, []);

  // Auto-expire stale imports (> 30 min) on mount
  useEffect(() => {
    if (persisted.importing && persisted.startedAt) {
      const elapsed = Date.now() - persisted.startedAt;
      if (elapsed > 30 * 60 * 1000) {
        // Stale import, reset
        setImporting(false);
        savePersistedState({ importing: false, progress: 0, startedAt: null });
      }
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResults(null);
    setParsedOrders([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Skip header row if exists (check if first row looks like header)
      const startRow = rawData.length > 0 && typeof rawData[0][4] !== 'number' ? 1 : 0;

      const orders: ParsedOrder[] = [];
      for (let i = startRow; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length < 7) continue;
        const parsed = parseVPhoneRow(row);
        if (parsed) orders.push(parsed);
      }

      setParsedOrders(orders);
      toast({
        title: 'Đọc file thành công',
        description: `Tìm thấy ${orders.length} đơn hàng, trong đó ${orders.filter(o => o.status === 'Hoàn tất' || o.status === 'Đã giao hàng').length} đơn hoàn tất sẽ được nhập.`,
      });
    } catch (err) {
      toast({ title: 'Lỗi đọc file', description: String(err), variant: 'destructive' });
    }
  };

  const handleImport = () => {
    if (!parsedOrders.length) return;

    updateImporting(true);
    updateProgress(0);
    savePersistedState({ fileName, importing: true, progress: 0, results: null, startedAt: Date.now() });

    // Run in background
    (async () => {
      const totalBatches = Math.ceil(parsedOrders.length / BATCH_SIZE);
      let totalResult: ImportResult = {
        totalOrders: 0, completedOrders: 0, createdReceipts: 0,
        createdItems: 0, customersCreated: 0, skipped: 0,
      };

      try {
        for (let i = 0; i < totalBatches; i++) {
          const batch = parsedOrders.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
          const { data, error } = await supabase.functions.invoke('import-historical-orders', {
            body: { orders: batch, sourceId },
          });
          if (error) throw error;
          if (data) {
            totalResult.totalOrders += data.totalOrders || 0;
            totalResult.completedOrders += data.completedOrders || 0;
            totalResult.createdReceipts += data.createdReceipts || 0;
            totalResult.createdItems += data.createdItems || 0;
            totalResult.customersCreated += data.customersCreated || 0;
            totalResult.skipped += data.skipped || 0;
          }
          updateProgress(Math.round(((i + 1) / totalBatches) * 100));
        }

        updateResults(totalResult);
        toast({
          title: '✅ Nhập dữ liệu thành công!',
          description: `Đã tạo ${totalResult.createdReceipts} phiếu bán, ${totalResult.createdItems} sản phẩm cho ${totalResult.customersCreated} khách hàng.`,
        });
      } catch (err: any) {
        updateImporting(false);
        savePersistedState({ importing: false });
        toast({
          title: 'Lỗi nhập dữ liệu',
          description: err.message || String(err),
          variant: 'destructive',
        });
      }
    })();

    toast({
      title: 'Đang nhập dữ liệu ngầm...',
      description: 'Bạn có thể tiếp tục sử dụng ứng dụng. Sẽ có thông báo khi hoàn tất.',
    });
  };

  const completedCount = parsedOrders.filter(
    (o) => o.status === 'Hoàn tất' || o.status === 'Đã giao hàng'
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Nhập đơn hàng lịch sử (VPhone)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium">Lưu ý quan trọng:</p>
              <ul className="list-disc ml-4 mt-1 space-y-1">
                <li>Chỉ nhập các đơn <strong>Hoàn tất / Đã giao hàng</strong></li>
                <li><strong>KHÔNG</strong> tạo bút toán sổ quỹ (cash book)</li>
                <li>Mã phiếu có tiền tố <code>{sourceId.toUpperCase()}-</code> để phân biệt</li>
                <li>Đơn trùng mã sẽ tự động bỏ qua (an toàn chạy lại)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Mã nguồn (Source ID)</Label>
            <Input
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              placeholder="backup"
              disabled={importing}
            />
            <p className="text-xs text-muted-foreground mt-1">Dùng để phân biệt dữ liệu cũ với dữ liệu VKho</p>
          </div>
          <div>
            <Label>Chọn file Excel</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              disabled={importing}
            />
          </div>
        </div>

        {fileName && parsedOrders.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary">{fileName}</Badge>
            <Badge variant="outline">{parsedOrders.length} đơn tổng</Badge>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              {completedCount} đơn hoàn tất
            </Badge>
            <Badge variant="outline">
              {parsedOrders.length - completedCount} đơn bỏ qua (hủy/chờ)
            </Badge>
          </div>
        )}

        {importing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Đang nhập dữ liệu... {progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {results && (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-300">Hoàn tất!</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div>Tổng đơn: <strong>{results.totalOrders}</strong></div>
              <div>Đơn hoàn tất: <strong>{results.completedOrders}</strong></div>
              <div>Phiếu tạo: <strong>{results.createdReceipts}</strong></div>
              <div>Sản phẩm: <strong>{results.createdItems}</strong></div>
              <div>Khách hàng: <strong>{results.customersCreated}</strong></div>
              <div>Bỏ qua (trùng): <strong>{results.skipped}</strong></div>
            </div>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={importing || completedCount === 0}
          className="w-full sm:w-auto"
        >
          <Upload className="h-4 w-4 mr-2" />
          {importing ? 'Đang nhập...' : `Nhập ${completedCount} đơn hàng`}
        </Button>
      </CardContent>
    </Card>
  );
}
