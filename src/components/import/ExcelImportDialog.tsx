import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ImportReceiptItem } from '@/types/warehouse';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  suppliers?: { id: string; name: string }[];
  branches?: { id: string; name: string }[];
  onImport: (items: ImportReceiptItem[], supplierName?: string, branchName?: string) => void;
  checkIMEI: (imei: string) => Promise<any>;
}

interface ParsedRow {
  imei?: string;
  productName: string;
  sku: string;
  importPrice: number;
  importDate?: string;
  supplierName?: string;
  branchName?: string;
  categoryName: string;
  categoryId?: string;
  quantity: number;
  note?: string;
  isValid: boolean;
  errors: string[];
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  categories,
  suppliers = [],
  branches = [],
  onImport,
  checkIMEI,
}: ExcelImportDialogProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Skip header row
      const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
      
      const parsed: ParsedRow[] = rows.map((row) => {
        const errors: string[] = [];
        
        // Column order: IMEI | Tên sản phẩm | SKU | Giá nhập | Ngày nhập | Nhà cung cấp | Chi nhánh | Thư mục | Số lượng | Ghi chú | Trạng thái
        const imei = row[0] ? String(row[0]).trim() : undefined;
        const productName = String(row[1] || '').trim();
        const sku = String(row[2] || '').trim();
        const importPrice = Number(row[3]) || 0;
        const importDate = row[4] ? String(row[4]).trim() : undefined;
        const supplierName = row[5] ? String(row[5]).trim() : undefined;
        const branchName = row[6] ? String(row[6]).trim() : undefined;
        const categoryName = String(row[7] || '').trim(); // Thư mục = Danh mục
        const quantity = imei ? 1 : (Number(row[8]) || 1); // IMEI products always have quantity 1
        const note = row[9] ? String(row[9]).trim() : undefined;
        // Column 10 is Trạng thái - ignored on import (always "Tồn kho" for new items)

        // Validate required fields
        if (!productName) errors.push('Thiếu tên sản phẩm');
        if (!sku) errors.push('Thiếu SKU');
        if (!categoryName) errors.push('Thiếu thư mục/danh mục');
        if (importPrice <= 0) errors.push('Giá nhập không hợp lệ');
        if (quantity < 1) errors.push('Số lượng không hợp lệ');

        // Find matching category (Thư mục)
        const matchedCategory = categories.find(
          (c) => c.name.toLowerCase() === categoryName.toLowerCase()
        );
        if (categoryName && !matchedCategory) {
          errors.push(`Thư mục "${categoryName}" không tồn tại`);
        }

        // Validate supplier if provided
        if (supplierName && suppliers.length > 0) {
          const matchedSupplier = suppliers.find(
            (s) => s.name.toLowerCase() === supplierName.toLowerCase()
          );
          if (!matchedSupplier) {
            errors.push(`NCC "${supplierName}" không tồn tại`);
          }
        }

        // Validate branch if provided
        if (branchName && branches.length > 0) {
          const matchedBranch = branches.find(
            (b) => b.name.toLowerCase() === branchName.toLowerCase()
          );
          if (!matchedBranch) {
            errors.push(`Chi nhánh "${branchName}" không tồn tại`);
          }
        }

        return {
          imei,
          productName,
          sku,
          importPrice,
          importDate,
          supplierName,
          branchName,
          categoryName,
          categoryId: matchedCategory?.id,
          quantity,
          note,
          isValid: errors.length === 0,
          errors,
        };
      });

      setParsedRows(parsed);

      // Validate IMEIs against database
      setIsValidating(true);
      const imeiRows = parsed.filter(row => row.imei);
      const checkedIMEIs = new Set<string>();
      
      for (const row of imeiRows) {
        if (row.imei) {
          // Check for duplicates in the same file
          if (checkedIMEIs.has(row.imei)) {
            row.isValid = false;
            row.errors.push(`IMEI "${row.imei}" bị trùng trong file`);
          } else {
            checkedIMEIs.add(row.imei);
            
            // Check against database
            try {
              const existing = await checkIMEI(row.imei);
              if (existing) {
                row.isValid = false;
                row.errors.push(`IMEI "${row.imei}" đã tồn tại trong kho`);
              }
            } catch (error) {
              console.error('Error checking IMEI:', error);
            }
          }
        }
      }
      setIsValidating(false);
      setParsedRows([...parsed]); // Force re-render

    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast({
        title: 'Lỗi đọc file',
        description: 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = () => {
    const validRows = parsedRows.filter((row) => row.isValid);
    if (validRows.length === 0) {
      toast({
        title: 'Không có dữ liệu hợp lệ',
        description: 'Vui lòng sửa các lỗi trong file Excel và thử lại',
        variant: 'destructive',
      });
      return;
    }

    const items: ImportReceiptItem[] = validRows.map((row, index) => ({
      id: String(Date.now() + index),
      productName: row.productName,
      sku: row.sku,
      imei: row.imei,
      categoryId: row.categoryId || '',
      categoryName: row.categoryName,
      importPrice: row.importPrice,
      quantity: row.quantity,
      supplierId: '',
      supplierName: row.supplierName || '',
      note: row.note,
    }));

    // Extract first supplier/branch for the receipt
    const firstSupplier = validRows.find(r => r.supplierName)?.supplierName;
    const firstBranch = validRows.find(r => r.branchName)?.branchName;
    
    onImport(items, firstSupplier, firstBranch);
    toast({
      title: 'Nhập dữ liệu thành công',
      description: `Đã thêm ${items.length} sản phẩm vào giỏ nhập hàng`,
    });
    onOpenChange(false);
    setParsedRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Nhập hàng từ Excel
          </DialogTitle>
          <DialogDescription>
            Tải lên file Excel theo mẫu để nhập nhiều sản phẩm cùng lúc
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="form-field">
            <Label htmlFor="excelFile">Chọn file Excel (.xlsx, .xls)</Label>
            <Input
              ref={fileInputRef}
              id="excelFile"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Đang đọc file...</span>
            </div>
          )}

          {isValidating && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Đang kiểm tra IMEI trùng...
            </div>
          )}

          {parsedRows.length > 0 && !isLoading && (
            <>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Hợp lệ: {validCount}</span>
                </div>
                <div className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>Lỗi: {invalidCount}</span>
                </div>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">STT</th>
                      <th className="p-2 text-left">IMEI</th>
                      <th className="p-2 text-left">Tên sản phẩm</th>
                      <th className="p-2 text-left">SKU</th>
                      <th className="p-2 text-right">Giá nhập</th>
                      <th className="p-2 text-left">NCC</th>
                      <th className="p-2 text-left">Thư mục</th>
                      <th className="p-2 text-center">SL</th>
                      <th className="p-2 text-left">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, index) => (
                      <tr
                        key={index}
                        className={row.isValid ? '' : 'bg-destructive/10'}
                      >
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2 font-mono text-xs">{row.imei || '-'}</td>
                        <td className="p-2 max-w-[150px] truncate">{row.productName}</td>
                        <td className="p-2 text-xs">{row.sku}</td>
                        <td className="p-2 text-right">
                          {formatCurrencyWithSpaces(row.importPrice)}
                        </td>
                        <td className="p-2 text-xs">{row.supplierName || '-'}</td>
                        <td className="p-2">{row.categoryName}</td>
                        <td className="p-2 text-center">{row.quantity}</td>
                        <td className="p-2">
                          {row.isValid ? (
                            <span className="text-success flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              OK
                            </span>
                          ) : (
                            <span className="text-destructive text-xs">
                              {row.errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || isLoading || isValidating}
          >
            <Upload className="mr-2 h-4 w-4" />
            Thêm {validCount} sản phẩm vào giỏ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
