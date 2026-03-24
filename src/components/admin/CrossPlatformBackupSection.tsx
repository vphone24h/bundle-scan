import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  RefreshCw, FileJson, Shield 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('cross-platform-backup');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `VKHO_backup_${data.tenant_name || 'store'}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const meta = data._metadata || {};
      toast.success(`Đã xuất thành công: ${meta.total_products || 0} SP, ${meta.total_customers || 0} KH, ${meta.total_suppliers || 0} NCC`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Lỗi xuất dữ liệu: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
      toast.error('Vui lòng chọn file JSON');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version) {
          toast.error('File không hợp lệ: thiếu version');
          return;
        }
        if (data.version !== '1.0') {
          toast.error(`Version "${data.version}" không được hỗ trợ`);
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
    // Reset input
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleConfirmImport = () => {
    setShowImportDialog(false);
    setShowConfirmDialog(true);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setShowConfirmDialog(false);
    setIsImporting(true);
    
    try {
      console.log('Sending import request, mode:', importMode);
      const { data, error } = await supabase.functions.invoke('cross-platform-restore', {
        body: { importData: importFile, mode: importMode },
      });
      
      console.log('Import response:', { data, error });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setImportResult(data);
      setShowResultDialog(true);
      setImportFile(null);
      setImportPreview(null);
      
      if (data?.total_errors > 0) {
        toast.warning(`Import hoàn tất với ${data.total_errors} lỗi`);
      } else {
        toast.success('Import dữ liệu hoàn tất!');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Lỗi import: ' + (error as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

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
          {/* Info */}
          <div className="p-3 rounded-lg bg-emerald-100/50 border border-emerald-200 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium text-emerald-800">
              <Shield className="h-4 w-4" />
              Tính năng chính
            </div>
            <ul className="list-disc list-inside text-emerald-700 space-y-0.5 ml-1 text-xs">
              <li>Sử dụng external_id thay vì UUID - tương thích mọi database</li>
              <li>Giữ nguyên liên kết: NCC ↔ Phiếu nhập, KH ↔ Phiếu xuất</li>
              <li>Bao gồm: Sản phẩm, KH, NCC, Phiếu nhập/xuất, Sổ quỹ, Cấu hình web</li>
              <li>Version 1.0 - đảm bảo tương thích giữa các phiên bản</li>
            </ul>
          </div>

          {/* Export */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {isExporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang xuất...</>
              ) : (
                <><ArrowDownToLine className="h-4 w-4 mr-2" />Sao lưu (Export JSON)</>
              )}
            </Button>
            
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={isImporting}
              variant="outline"
              className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang nhập...</>
              ) : (
                <><ArrowUpFromLine className="h-4 w-4 mr-2" />Khôi phục (Import JSON)</>
              )}
            </Button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />

          <p className="text-xs text-muted-foreground text-center">
            💡 File JSON có thể import vào hệ thống VKHO trên VPS hoặc Cloud khác
          </p>
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
            <DialogDescription>
              Kiểm tra dữ liệu trước khi nhập vào hệ thống
            </DialogDescription>
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
                ].filter(([, v]) => v > 0).map(([label, count]) => (
                  <div key={label as string} className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">{label}</span>
                    <Badge variant="secondary">{count}</Badge>
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
                      <p className="text-xs text-muted-foreground">Thêm mới, giữ nguyên dữ liệu hiện tại</p>
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
            <Button onClick={handleConfirmImport} className="bg-emerald-600 hover:bg-emerald-700">
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
                ? 'Toàn bộ dữ liệu hiện tại sẽ bị ghi đè. Hành động này không thể hoàn tác.'
                : 'Dữ liệu mới sẽ được thêm vào hệ thống. Dữ liệu hiện tại được giữ nguyên.'}
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

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Kết quả Import
            </DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(importResult.results || {}).map(([key, count]) => (
                  <div key={key} className="flex justify-between p-2 rounded bg-emerald-50 border border-emerald-100">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    <Badge className="bg-emerald-600">{count as number}</Badge>
                  </div>
                ))}
              </div>
              
              {importResult.total_errors > 0 && (
                <div className="p-3 rounded border border-orange-200 bg-orange-50 text-sm">
                  <p className="font-medium text-orange-700 mb-1">
                    ⚠️ {importResult.total_errors} lỗi
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
