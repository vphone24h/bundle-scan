import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, Wrench, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

type ParsedRow = {
  imei: string;
  name: string;
  sku: string;
  supplierName?: string | null;
  note?: string | null;
  importDate?: string | null; // dd/mm/yyyy
  status?: string | null;
};

function normalizeText(v: unknown): string {
  return String(v ?? '').trim();
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function RestoreSupplierNoteSection() {
  const { data: tenant } = useCurrentTenant();
  const queryClient = useQueryClient();

  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<{ processed: number; updated: number; notFound: number; supplierCreated: number } | null>(null);

  const canRun = useMemo(() => !!tenant?.id && rows.length > 0 && !isRunning, [tenant?.id, rows.length, isRunning]);

  const parseFile = async (file: File) => {
    setIsParsing(true);
    setStats(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error('Không tìm thấy sheet trong file');
      const ws = wb.Sheets[sheetName];
      if (!ws) throw new Error('Không đọc được sheet');

      // Read as array of objects with Vietnamese headers
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      const parsed: ParsedRow[] = json
        .map((r) => {
          const imei = normalizeText(r['IMEI']);
          const name = normalizeText(r['Tên sản phẩm']);
          const sku = normalizeText(r['SKU']);
          const supplierName = normalizeText(r['Nhà cung cấp']) || null;
          const note = normalizeText(r['Ghi chú']) || null;
          const importDate = normalizeText(r['Ngày nhập']) || null;
          const status = normalizeText(r['Trạng thái']) || null;
          return { imei, name, sku, supplierName, note, importDate, status };
        })
        .filter((r) => r.imei && r.name && r.sku);

      if (parsed.length === 0) {
        throw new Error('File không có dòng hợp lệ (cần IMEI, Tên sản phẩm, SKU)');
      }

      setRows(parsed);
      toast.success(`Đã đọc ${parsed.length} dòng từ file`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Không đọc được file');
      setRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const runRestore = async () => {
    if (!tenant?.id) return;
    if (rows.length === 0) {
      toast.error('Chưa có dữ liệu từ file');
      return;
    }

    setIsRunning(true);
    setStats({ processed: 0, updated: 0, notFound: 0, supplierCreated: 0 });
    try {
      const batches = chunk(rows, 400);
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const { data, error } = await supabase.functions.invoke('restore-product-metadata', {
          body: {
            tenantId: tenant.id,
            matchRule: 'imei_only',
            duplicateRule: 'latest',
            fillMode: 'fill_missing_only',
            rows: batch,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setStats((prev) => {
          const p = prev ?? { processed: 0, updated: 0, notFound: 0, supplierCreated: 0 };
          return {
            processed: p.processed + (data?.processed ?? 0),
            updated: p.updated + (data?.updated ?? 0),
            notFound: p.notFound + (data?.notFound ?? 0),
            supplierCreated: p.supplierCreated + (data?.supplierCreated ?? 0),
          };
        });
      }

      // Refresh data views
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });

      toast.success('Đã hoàn tất đối chiếu & bổ sung NCC/Ghi chú');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Không thể chạy phục hồi');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Phục hồi Nhà cung cấp & Ghi chú (từ file cũ)
        </CardTitle>
        <CardDescription>
          Đối chiếu theo <b>IMEI + Tên + SKU</b>, nếu trùng nhiều dòng sẽ lấy <b>dòng mới nhất</b> (theo “Ngày nhập”).
          Hệ thống chỉ <b>bổ sung phần đang thiếu</b> (không ghi đè dữ liệu đã có).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert>
          <FileSpreadsheet className="h-4 w-4" />
          <AlertTitle>Lưu ý</AlertTitle>
          <AlertDescription>
            File cần có đúng các cột: <b>IMEI</b>, <b>Tên sản phẩm</b>, <b>SKU</b>, <b>Nhà cung cấp</b>, <b>Ghi chú</b>, <b>Ngày nhập</b>.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Chọn file Excel</Label>
          <Input
            type="file"
            accept=".xlsx,.xls"
            disabled={isParsing || isRunning}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFileName(f.name);
              void parseFile(f);
            }}
          />
          {fileName && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Upload className="h-4 w-4" /> {fileName}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {isParsing ? 'Đang đọc file…' : rows.length > 0 ? `Đã đọc ${rows.length} dòng.` : 'Chưa có dữ liệu.'}
          </div>
          <Button onClick={runRestore} disabled={!canRun}>
            {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Bổ sung NCC & Ghi chú
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Đã xử lý</div>
              <div className="text-lg font-semibold">{stats.processed}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Đã cập nhật</div>
              <div className="text-lg font-semibold">{stats.updated}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Không khớp SP</div>
              <div className="text-lg font-semibold">{stats.notFound}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Tạo NCC mới</div>
              <div className="text-lg font-semibold">{stats.supplierCreated}</div>
            </div>
          </div>
        )}

        {(rows.length > 0 && stats?.notFound) ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Có sản phẩm không khớp</AlertTitle>
            <AlertDescription>
              Một số dòng trong file không tìm thấy sản phẩm tương ứng trong hệ thống (theo IMEI+Tên+SKU). Nếu bạn muốn, mình có thể bổ sung thêm chế độ “khớp mềm” (IMEI+SKU) để tăng tỷ lệ khớp.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
