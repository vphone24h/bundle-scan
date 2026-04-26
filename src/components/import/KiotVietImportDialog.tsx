import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ImportReceiptItem } from '@/types/warehouse';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { useCreateCategory } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import kiotvietGuideFile1 from '@/assets/kiotviet-guide-file1.png';
import kiotvietGuideFile2 from '@/assets/kiotviet-guide-file2.jpeg';

interface KiotVietImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  suppliers?: { id: string; name: string }[];
  branches?: { id: string; name: string }[];
  onImportMultiple: (groups: { items: ImportReceiptItem[]; supplierName: string; branchName?: string; isNewSupplier: boolean }[]) => void;
  checkIMEI: (imei: string) => Promise<any>;
  batchCheckIMEI?: (imeis: string[]) => Promise<Set<string>>;
}

interface KVParsedRow {
  imei?: string;
  productName: string;
  sku: string;
  importPrice: number;
  salePrice?: number;
  importDate?: string;
  branchName?: string;
  categoryName: string;
  categoryId?: string;
  quantity: number;
  note?: string;
  isValid: boolean;
  errors: string[];
}

// KiotViet column mapping:
// Col 0: Loại hàng
// Col 1: Nhóm hàng(3 Cấp) 
// Col 2: Mã hàng
// Col 3: Mã vạch
// Col 4: Tên hàng → productName + sku
// Col 5: Thương hiệu → categoryName
// Col 6: Giá bán → salePrice
// Col 7: Giá vốn → importPrice
// Col 8: Tồn kho → quantity
// Col 21: Serial/IMEI → imei
// Col 25: Mẫu ghi chú → note
// Col 26: Vị trí → branchName
// Col 30: Thời gian tạo → importDate

function findColumnIndex(headers: any[], ...keywords: string[]): number {
  for (const keyword of keywords) {
    const idx = headers.findIndex(h => 
      h && String(h).toLowerCase().trim().includes(keyword.toLowerCase())
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

function splitKiotVietImeis(value: unknown): string[] {
  return String(value || '')
    .split(/[|｜\n\r]+/)
    .map((item) => item.trim())
    .filter((item) => item && item !== '0');
}

export function KiotVietImportDialog({
  open, onOpenChange, categories, suppliers = [], branches = [], onImportMultiple, checkIMEI, batchCheckIMEI,
}: KiotVietImportDialogProps) {
  const createCategory = useCreateCategory();
  const [parsedRows, setParsedRows] = useState<KVParsedRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [guideStep, setGuideStep] = useState(0); // 0..N = guide step, -1 = done/upload mode
  const [guidePhase, setGuidePhase] = useState<1 | 2>(1); // 1 = file SP, 2 = file Nhập hàng (NCC)
  // Supplier maps from "Nhập hàng" file (file 2)
  const [supplierByImei, setSupplierByImei] = useState<Map<string, string>>(new Map());
  const [supplierByName, setSupplierByName] = useState<Map<string, string>>(new Map());
  const [supplierFileName, setSupplierFileName] = useState<string>('');
  const [supplierFileCount, setSupplierFileCount] = useState<number>(0);
  const [isLoadingSupplier, setIsLoadingSupplier] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supplierFileInputRef = useRef<HTMLInputElement>(null);

  // Reset guide when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setGuideStep(0);
      setGuidePhase(1);
      setParsedRows([]);
      setSupplierByImei(new Map());
      setSupplierByName(new Map());
      setSupplierFileName('');
      setSupplierFileCount(0);
    }
    onOpenChange(open);
  };

  const guideStepsFile1 = [
    { step: 1, title: 'Đăng nhập KiotViet', desc: 'Truy cập trang quản lý KiotViet trên máy tính (điện thoại không xuất được file). Vào kiotviet.vn và đăng nhập.' },
    { step: 2, title: 'Vào tab Hàng Hóa', desc: 'Trên thanh menu bên trái, chọn mục "Hàng hóa".' },
    { step: 3, title: 'Danh sách hàng hóa', desc: 'Mở trang "Danh sách hàng hóa" để xem toàn bộ sản phẩm.' },
    { step: 4, title: 'Xuất file Excel', desc: 'Nhấn nút "Xuất file" ở góc phải để tải file Excel chứa danh sách sản phẩm.' },
    { step: 5, title: 'Tải lên VKHO', desc: 'Dùng file Excel vừa tải về, nhấn nút bên dưới để upload lên hệ thống VKHO.' },
  ];

  const guideStepsFile2 = [
    { step: 1, title: 'Vào KiotViet', desc: 'Đăng nhập KiotViet trên máy tính (kiotviet.vn).' },
    { step: 2, title: 'Vào tab Mua hàng', desc: 'Trên menu KiotViet, nhấn vào mục "Mua hàng" (nằm kế bên nút "Hàng hóa").' },
    { step: 3, title: 'Mở Nhập hàng', desc: 'Chọn mục "Nhập hàng" để xem toàn bộ phiếu nhập đã thực hiện.' },
    { step: 4, title: 'Chọn mốc thời gian', desc: 'Chọn khoảng thời gian bao trùm toàn bộ thời gian bạn đã hoạt động trên KiotViet (ví dụ "Toàn thời gian").' },
    { step: 5, title: 'Nhấn nút Xuất file / Chọn file chi tiết', desc: 'Nhấn nút "Xuất file", sau đó chọn "File chi tiết" để tải file Excel về máy.' },
    { step: 6, title: 'Tải file lên VKHO', desc: 'Dùng file Excel "Danh sách chi tiết nhập hàng" vừa tải về, nhấn nút bên dưới để upload — VKHO sẽ ghép Nhà cung cấp theo IMEI / tên sản phẩm.' },
  ];

  const guideSteps = guidePhase === 1 ? guideStepsFile1 : guideStepsFile2;

  const handleSupplierFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoadingSupplier(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (data.length < 2) {
        toast({ title: 'File NCC trống', variant: 'destructive' });
        return;
      }
      const headers = data[0];
      const colNcc = findColumnIndex(headers, 'Tên nhà cung cấp', 'Nhà cung cấp');
      const colTen = findColumnIndex(headers, 'Tên hàng');
      const colImei = findColumnIndex(headers, 'Serial/IMEI', 'Serial', 'IMEI');
      if (colNcc < 0 || colTen < 0) {
        toast({
          title: 'File không đúng định dạng',
          description: 'Cần có cột "Tên nhà cung cấp" và "Tên hàng". Vui lòng xuất từ Mua hàng → Nhập hàng.',
          variant: 'destructive',
        });
        return;
      }
      const mapImei = new Map<string, string>();
      const mapName = new Map<string, string>();
      let count = 0;
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const ncc = String(row[colNcc] || '').trim();
        if (!ncc) continue;
        const ten = String(row[colTen] || '').trim();
        const imeis = colImei >= 0 ? splitKiotVietImeis(row[colImei]) : [];
        if (imeis.length > 0) {
          imeis.forEach(im => { if (!mapImei.has(im)) mapImei.set(im, ncc); });
          count += imeis.length;
        } else if (ten) {
          // SP không IMEI: fallback theo tên hàng (lấy NCC gần nhất theo thứ tự file - mới nhất)
          if (!mapName.has(ten.toLowerCase())) mapName.set(ten.toLowerCase(), ncc);
          count++;
        }
      }
      setSupplierByImei(mapImei);
      setSupplierByName(mapName);
      setSupplierFileName(file.name);
      setSupplierFileCount(count);
      toast({
        title: 'Đã đọc file Nhà cung cấp',
        description: `${mapImei.size} IMEI + ${mapName.size} tên SP có NCC`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Lỗi đọc file NCC', variant: 'destructive' });
    } finally {
      setIsLoadingSupplier(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast({ title: 'File trống', description: 'Không tìm thấy dữ liệu trong file', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const headers = jsonData[0];
      
      // Auto-detect columns by header name
      const colTenHang = findColumnIndex(headers, 'Tên hàng');
      const colThuongHieu = findColumnIndex(headers, 'Thương hiệu');
      const colNhomHang = findColumnIndex(headers, 'Nhóm hàng', 'Nhóm');
      const colGiaVon = findColumnIndex(headers, 'Giá vốn');
      const colGiaBan = findColumnIndex(headers, 'Giá bán');
      const colTonKho = findColumnIndex(headers, 'Tồn kho');
      const colSerial = findColumnIndex(headers, 'Serial/IMEI', 'Serial', 'IMEI');
      const colGhiChu = findColumnIndex(headers, 'Mẫu ghi chú', 'Ghi chú');
      const colViTri = findColumnIndex(headers, 'Vị trí');
      const colThoiGian = findColumnIndex(headers, 'Thời gian tạo', 'Ngày tạo');
      const colMaHang = findColumnIndex(headers, 'Mã hàng');

      if (colTenHang < 0) {
        toast({ title: 'Không nhận diện được file KiotViet', description: 'Không tìm thấy cột "Tên hàng". Vui lòng kiểm tra file.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

      const parsed: KVParsedRow[] = (rows.flatMap((row) => {
        const errors: string[] = [];

        const tenHang = String(row[colTenHang] || '').trim();
        const maHang = colMaHang >= 0 ? String(row[colMaHang] || '').trim() : '';
        // Tên hàng = productName AND sku
        const productName = tenHang;
        const sku = maHang || tenHang;
        
        // Danh mục lấy từ cột "Nhóm hàng" (KiotViet 3 cấp: A>>B>>C → lấy cấp cuối).
        // Fallback sang "Thương hiệu" nếu không có Nhóm hàng.
        let categoryName = '';
        if (colNhomHang >= 0) {
          const raw = String(row[colNhomHang] || '').trim();
          if (raw) {
            const parts = raw.split(/>>|>|\/|\\|\|/).map(s => s.trim()).filter(Boolean);
            categoryName = parts.length > 0 ? parts[parts.length - 1] : raw;
          }
        }
        if (!categoryName && colThuongHieu >= 0) {
          categoryName = String(row[colThuongHieu] || '').trim();
        }
        const importPrice = colGiaVon >= 0 ? (Number(row[colGiaVon]) || 0) : 0;
        const rawSalePrice = colGiaBan >= 0 ? (Number(row[colGiaBan]) || 0) : 0;
        const stockQty = colTonKho >= 0 ? (Number(row[colTonKho]) || 0) : 1;
        const imeiList = colSerial >= 0 ? splitKiotVietImeis(row[colSerial]) : [];
        const hasImeis = imeiList.length > 0;
        const note = colGhiChu >= 0 ? String(row[colGhiChu] || '').trim() : '';
        const branchName = colViTri >= 0 ? String(row[colViTri] || '').trim() : '';
        
        let importDate: string | undefined;
        if (colThoiGian >= 0 && row[colThoiGian]) {
          const val = row[colThoiGian];
          if (val instanceof Date) {
            importDate = val.toISOString();
          } else {
            importDate = String(val);
          }
        }

        // Auto sale price
        let salePrice = rawSalePrice > 0 ? rawSalePrice : undefined;
        if (!salePrice && importPrice > 0) {
          salePrice = hasImeis ? importPrice + 2000000 : importPrice * 2;
        }

        // Skip products with 0 stock (unless has IMEI)
        if (!hasImeis && stockQty <= 0) {
          return [];
        }

        // Validate
        if (!productName) errors.push('Thiếu tên hàng');
        if (importPrice <= 0) errors.push('Giá vốn = 0');

        // Match category (Thương hiệu → Danh mục)
        let categoryId: string | undefined;
        if (categoryName) {
          const matched = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
          if (matched) {
            categoryId = matched.id;
          }
          // Don't error if category not found - will create or skip
        }

        const buildRow = (imei?: string, quantity = 1): KVParsedRow => ({
          imei,
          productName,
          sku,
          importPrice,
          salePrice,
          importDate,
          branchName: branchName || undefined,
          categoryName: categoryName || 'Chưa phân loại',
          categoryId,
          quantity,
          note: note || undefined,
          isValid: errors.length === 0,
          errors: [...errors],
        });

        if (hasImeis) {
          return imeiList.map((imei) => buildRow(imei, 1));
        }

        return [buildRow(undefined, Math.max(stockQty, 1))];
      })) as KVParsedRow[];

      setParsedRows(parsed);

      // Validate IMEIs
      const imeiRows = parsed.filter(row => row.imei);
      if (imeiRows.length > 0) {
        setIsValidating(true);
        setValidationProgress(0);

        const checkedIMEIs = new Set<string>();
        const duplicateInFile = new Set<string>();
        imeiRows.forEach(row => {
          if (row.imei) {
            if (checkedIMEIs.has(row.imei)) duplicateInFile.add(row.imei);
            else checkedIMEIs.add(row.imei);
          }
        });
        imeiRows.forEach(row => {
          if (row.imei && duplicateInFile.has(row.imei)) {
            row.isValid = false;
            row.errors.push(`IMEI "${row.imei}" trùng trong file`);
          }
        });
        setValidationProgress(30);

        try {
          let existingIMEIs: Set<string>;
          const uniqueIMEIs = Array.from(checkedIMEIs);
          if (batchCheckIMEI) {
            existingIMEIs = await batchCheckIMEI(uniqueIMEIs);
          } else {
            existingIMEIs = new Set<string>();
            for (let i = 0; i < uniqueIMEIs.length; i += 10) {
              const batch = uniqueIMEIs.slice(i, i + 10);
              const results = await Promise.all(batch.map(async (im) => {
                const existing = await checkIMEI(im);
                return existing ? im : null;
              }));
              results.forEach(im => { if (im) existingIMEIs.add(im); });
              setValidationProgress(30 + Math.round((i / uniqueIMEIs.length) * 60));
            }
          }
          setValidationProgress(90);
          imeiRows.forEach(row => {
            if (row.imei && existingIMEIs.has(row.imei) && !row.errors.some(e => e.includes('trùng trong file'))) {
              row.isValid = false;
              row.errors.push(`IMEI đã tồn tại trong kho`);
            }
          });
        } catch {
          toast({ title: 'Lỗi kiểm tra IMEI', variant: 'destructive' });
        }
        setValidationProgress(100);
        setIsValidating(false);
        setParsedRows([...parsed]);
      }

    } catch (error) {
      console.error('Error parsing KiotViet file:', error);
      toast({ title: 'Lỗi đọc file', description: 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve supplier name for a row from supplier maps (file 2)
  const resolveSupplier = (row: KVParsedRow): string => {
    if (row.imei && supplierByImei.has(row.imei)) return supplierByImei.get(row.imei)!;
    const byName = supplierByName.get(row.productName.toLowerCase());
    if (byName) return byName;
    return 'KiotViet Import';
  };

  // Group by (supplier + branch)
  const branchGroups = useMemo(() => {
    const validRows = parsedRows.filter(r => r.isValid);
    const groupMap = new Map<string, { supplierName: string; branchName: string; rows: KVParsedRow[] }>();
    validRows.forEach(row => {
      const supplierName = resolveSupplier(row);
      const branchName = row.branchName || 'Không xác định';
      const key = `${supplierName}|||${branchName}`;
      if (!groupMap.has(key)) groupMap.set(key, { supplierName, branchName, rows: [] });
      groupMap.get(key)!.rows.push(row);
    });
    return Array.from(groupMap.values()).map(g => ({
      supplierName: g.supplierName,
      branchName: g.branchName,
      rows: g.rows,
      validCount: g.rows.length,
      totalAmount: g.rows.reduce((sum, r) => sum + r.importPrice * r.quantity, 0),
    }));
  }, [parsedRows, supplierByImei, supplierByName]);

  // Stats: how many rows matched a supplier from file 2
  const supplierMatchStats = useMemo(() => {
    const valid = parsedRows.filter(r => r.isValid);
    let matched = 0;
    valid.forEach(r => {
      if (r.imei && supplierByImei.has(r.imei)) matched++;
      else if (supplierByName.has(r.productName.toLowerCase())) matched++;
    });
    return { matched, total: valid.length };
  }, [parsedRows, supplierByImei, supplierByName]);

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast({ title: 'Không có dữ liệu hợp lệ', variant: 'destructive' });
      return;
    }

    // Auto-create missing categories from "Nhóm hàng" column
    const existingByName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
    const missingNames = Array.from(new Set(
      validRows
        .map(r => r.categoryName)
        .filter(n => n && n !== 'Chưa phân loại' && !existingByName.has(n.toLowerCase()))
    ));

    if (missingNames.length > 0) {
      try {
        for (const name of missingNames) {
          const created = await createCategory.mutateAsync({ name });
          existingByName.set(name.toLowerCase(), created.id);
        }
        toast({
          title: 'Đã tạo danh mục mới',
          description: `${missingNames.length} danh mục: ${missingNames.join(', ')}`,
        });
      } catch (err: any) {
        toast({
          title: 'Lỗi tạo danh mục',
          description: err?.message || 'Không thể tạo danh mục mới',
          variant: 'destructive',
        });
        return;
      }
    }

    // Re-map categoryId for all rows using the updated map
    validRows.forEach(r => {
      if (r.categoryName) {
        const id = existingByName.get(r.categoryName.toLowerCase());
        if (id) r.categoryId = id;
      }
    });

    // Group all valid rows by supplier + branch
    const groups = branchGroups.map(group => {
      const items: ImportReceiptItem[] = group.rows.map((row, index) => ({
        id: String(Date.now() + index + Math.random()),
        productName: row.productName,
        sku: row.sku,
        imei: row.imei,
        categoryId: row.categoryId || '',
        categoryName: row.categoryName,
        importPrice: row.importPrice,
        salePrice: row.salePrice,
        quantity: row.quantity,
        supplierId: '',
        supplierName: group.supplierName,
        note: row.note,
      }));

      return {
        items,
        supplierName: group.supplierName,
        branchName: group.branchName !== 'Không xác định' ? group.branchName : undefined,
        isNewSupplier: !suppliers.some(s => s.name.toLowerCase() === group.supplierName.toLowerCase()),
      };
    });

    // Deduplicate isNewSupplier per supplier name (only first occurrence creates)
    const seenNew = new Set<string>();
    const deduped = groups.map(g => {
      if (g.isNewSupplier) {
        const key = g.supplierName.toLowerCase();
        if (seenNew.has(key)) return { ...g, isNewSupplier: false };
        seenNew.add(key);
        return g;
      }
      return g;
    });

    onImportMultiple(deduped);

    toast({
      title: 'Nhập từ KiotViet thành công',
      description: `${deduped.length} phiếu nhập với ${validRows.length} sản phẩm`,
    });
    onOpenChange(false);
    setParsedRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  // Collect unique categories that don't exist yet
  const newCategories = useMemo(() => {
    const existingNames = new Set(categories.map(c => c.name.toLowerCase()));
    const found = new Set<string>();
    parsedRows.forEach(r => {
      if (r.categoryName && r.categoryName !== 'Chưa phân loại' && !existingNames.has(r.categoryName.toLowerCase())) {
        found.add(r.categoryName);
      }
    });
    return Array.from(found);
  }, [parsedRows, categories]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-orange-500" />
            Nhập hàng từ KiotViet
          </DialogTitle>
          <DialogDescription>
            {guideStep >= 0
              ? `Hướng dẫn ${guidePhase === 1 ? 'File 1: Danh sách sản phẩm' : 'File 2: Nhập hàng (Nhà cung cấp)'} — cần đủ 2 file để khôi phục đúng NCC`
              : 'Tải lên 2 file xuất từ KiotViet (SP + Nhập hàng) để chuyển đổi sang VKHO kèm Nhà cung cấp'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
          {/* Step-by-step guide */}
          {guideStep >= 0 && (
            <div className="space-y-3">
              {/* Phase tabs */}
              <div className="flex gap-2 border-b pb-2">
                <button
                  onClick={() => { setGuidePhase(1); setGuideStep(0); }}
                  className={`flex-1 text-xs font-medium px-3 py-2 rounded-t border-b-2 transition-colors ${
                    guidePhase === 1 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📦 File 1: Danh sách SP
                </button>
                <button
                  onClick={() => { setGuidePhase(2); setGuideStep(0); }}
                  className={`flex-1 text-xs font-medium px-3 py-2 rounded-t border-b-2 transition-colors ${
                    guidePhase === 2 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🏷️ File 2: Nhập hàng (NCC)
                </button>
              </div>

              {guidePhase === 2 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-medium mb-1">⚠️ Quan trọng</p>
                  <p>Phải nhập đủ <b>cả 2 file</b> mới khôi phục đúng Nhà cung cấp cho từng sản phẩm. Nếu chỉ nhập File 1, các sản phẩm sẽ thiếu NCC (gộp về "KiotViet Import").</p>
                </div>
              )}

              {/* Visual reference screenshot */}
              <div className="rounded-lg border bg-muted/30 p-2">
                <p className="text-[11px] text-muted-foreground mb-1.5 text-center">
                  📸 Ảnh minh hoạ: vị trí nút <b>{guidePhase === 1 ? '"Hàng hóa"' : '"Mua hàng"'}</b> trên KiotViet
                </p>
                <img
                  src={guidePhase === 1 ? kiotvietGuideFile1 : kiotvietGuideFile2}
                  alt={guidePhase === 1 ? 'Hướng dẫn vào tab Hàng hóa trên KiotViet' : 'Hướng dẫn vào tab Mua hàng trên KiotViet'}
                  className="w-full max-h-56 object-contain rounded-md bg-background"
                />
              </div>

              {guideSteps.map((s, idx) => (
                <div
                  key={s.step}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    idx === guideStep
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : idx < guideStep
                        ? 'border-muted bg-muted/30 opacity-60'
                        : 'border-muted/50 opacity-40'
                  }`}
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx < guideStep
                      ? 'bg-primary text-primary-foreground'
                      : idx === guideStep
                        ? 'bg-primary text-primary-foreground animate-pulse'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {idx < guideStep ? <CheckCircle2 className="h-4 w-4" /> : s.step}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}

              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGuideStep(prev => Math.max(0, prev - 1))}
                  disabled={guideStep === 0}
                >
                  ← Quay lại
                </Button>
                {guideStep < guideSteps.length - 1 ? (
                  <Button size="sm" onClick={() => setGuideStep(prev => prev + 1)}>
                    Tiếp theo →
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setGuideStep(-1)}>
                    <Upload className="mr-1.5 h-4 w-4" />
                    Tải file lên
                  </Button>
                )}
              </div>

              {/* Skip link */}
              <div className="text-center">
                <button
                  onClick={() => setGuideStep(-1)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Bỏ qua hướng dẫn, tải file lên ngay
                </button>
              </div>
            </div>
          )}

          {/* Upload mode */}
          {guideStep < 0 && (
            <>
              {/* Column mapping info */}
              <div className="bg-accent/50 border border-border rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">Ánh xạ cột tự động:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                  <span>Tên hàng → Tên SP & SKU</span>
                  <span>Nhóm hàng → Danh mục</span>
                  <span>Giá vốn → Giá nhập</span>
                  <span>Tồn kho → Số lượng</span>
                  <span>Serial/IMEI → IMEI</span>
                  <span>Mẫu ghi chú → Ghi chú</span>
                  <span>Vị trí → Chi nhánh</span>
                  <span>Thời gian tạo → Ngày nhập</span>
                </div>
              </div>

              <div className="form-field">
                <Label htmlFor="kvFile">📦 File 1 — Danh sách sản phẩm (.xlsx) <span className="text-destructive">*</span></Label>
                <Input
                  ref={fileInputRef}
                  id="kvFile"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
              </div>

              <div className="form-field">
                <Label htmlFor="kvSupplierFile" className="flex items-center gap-2">
                  🏷️ File 2 — Nhập hàng (chứa Nhà cung cấp) (.xlsx)
                  {supplierFileName && (
                    <span className="text-xs text-green-600 font-normal">✓ {supplierFileName}</span>
                  )}
                </Label>
                <Input
                  ref={supplierFileInputRef}
                  id="kvSupplierFile"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleSupplierFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Xuất từ KiotViet: <b>Mua hàng → Nhập hàng</b>, chọn mốc thời gian rồi <b>Xuất file</b>.
                  Hệ thống sẽ ghép NCC theo IMEI / tên SP. Nếu bỏ qua, các SP sẽ gộp về "KiotViet Import".
                </p>
                {isLoadingSupplier && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Đang đọc file NCC...
                  </p>
                )}
              </div>

              {!supplierFileName && parsedRows.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200">
                  ⚠️ Bạn chưa tải <b>File 2 (Nhập hàng)</b>. Toàn bộ sản phẩm sẽ bị thiếu thông tin Nhà cung cấp và gộp về một NCC mặc định "KiotViet Import". Khuyến nghị tải đủ 2 file.
                </div>
              )}

              {supplierFileName && parsedRows.length > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-xs text-emerald-900 dark:text-emerald-200">
                  ✓ Đã ghép NCC: <b>{supplierMatchStats.matched}/{supplierMatchStats.total}</b> sản phẩm có nhà cung cấp từ File 2.
                  {supplierMatchStats.matched < supplierMatchStats.total && (
                    <span> ({supplierMatchStats.total - supplierMatchStats.matched} SP không khớp sẽ gộp về "KiotViet Import")</span>
                  )}
                </div>
              )}

              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Đang đọc file KiotViet...</span>
                </div>
              )}

              {isValidating && (
                <div className="flex flex-col items-center justify-center py-4 text-muted-foreground gap-2">
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Đang kiểm tra IMEI trùng... {validationProgress > 0 && `(${validationProgress}%)`}
                  </div>
                  {validationProgress > 0 && (
                    <div className="w-full max-w-xs bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${validationProgress}%` }} />
                    </div>
                  )}
                </div>
              )}

              {parsedRows.length > 0 && !isLoading && (
                <>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Hợp lệ: {validCount}</span>
                    </div>
                    {invalidCount > 0 && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>Lỗi: {invalidCount}</span>
                      </div>
                    )}
                    {branchGroups.length > 1 && (
                      <div className="flex items-center gap-1 text-primary font-medium">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Sẽ tạo {branchGroups.length} phiếu (theo NCC + vị trí)</span>
                      </div>
                    )}
                  </div>

                  {newCategories.length > 0 && (
                    <div className="bg-accent/50 border border-border rounded-lg p-2 text-xs">
                      <span className="font-medium">Danh mục mới sẽ cần tạo: </span>
                      <span className="text-muted-foreground">{newCategories.join(', ')}</span>
                    </div>
                  )}

                  {branchGroups.length > 1 && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium">Phân nhóm theo NCC + vị trí:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {branchGroups.map((group, idx) => (
                          <div key={idx} className="bg-card border rounded p-2 text-sm">
                            <div className="font-medium truncate">{group.supplierName}</div>
                            <div className="text-muted-foreground text-xs">
                              {group.branchName} • {group.validCount} SP • {formatCurrencyWithSpaces(group.totalAmount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <ScrollArea className="h-[250px] border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">STT</th>
                          <th className="p-2 text-left">Tên hàng</th>
                          <th className="p-2 text-left">SKU</th>
                          <th className="p-2 text-left">IMEI</th>
                          <th className="p-2 text-right">Giá vốn</th>
                          <th className="p-2 text-center">SL</th>
                          <th className="p-2 text-left">Danh mục</th>
                          <th className="p-2 text-left">Vị trí</th>
                          <th className="p-2 text-center">TT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((row, index) => (
                          <tr key={index} className={row.isValid ? '' : 'bg-destructive/10'}>
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2 max-w-[150px] truncate">{row.productName}</td>
                            <td className="p-2 text-xs">{row.sku}</td>
                            <td className="p-2 font-mono text-xs">{row.imei || '-'}</td>
                            <td className="p-2 text-right">{formatCurrencyWithSpaces(row.importPrice)}</td>
                            <td className="p-2 text-center">{row.quantity}</td>
                            <td className="p-2 text-xs">{row.categoryName}</td>
                            <td className="p-2 text-xs">{row.branchName || '-'}</td>
                            <td className="p-2 text-center">
                              {row.isValid ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mx-auto" />
                              ) : (
                                <span className="text-destructive text-xs">{row.errors.join(', ')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </>
              )}
            </>
          )}
        </div>

        {guideStep < 0 && (
          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setGuideStep(0)}>
              ← Xem hướng dẫn
            </Button>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Huỷ</Button>
            <Button
              onClick={handleImport}
              disabled={validCount === 0 || isLoading || isValidating}
            >
              <Upload className="mr-2 h-4 w-4" />
              {branchGroups.length > 1
                ? `Tạo ${branchGroups.length} phiếu (${validCount} SP)`
                : `Nhập ${validCount} sản phẩm`
              }
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
