import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreVertical,
  Copy,
  Trash2,
  Star,
  Pencil,
  FileText,
  Power,
} from 'lucide-react';
import {
  useCustomPrintTemplates,
  useCreateCustomPrintTemplate,
  useUpdateCustomPrintTemplate,
  useDeleteCustomPrintTemplate,
  useDuplicateCustomPrintTemplate,
  useSetDefaultCustomPrintTemplate,
  type CustomPrintTemplate,
} from '@/hooks/useCustomPrintTemplates';
import { useBranches } from '@/hooks/useBranches';

export function CustomPrintTemplateList() {
  const { data: templates = [], isLoading } = useCustomPrintTemplates();
  const { data: branches = [] } = useBranches();
  const createMutation = useCreateCustomPrintTemplate();
  const updateMutation = useUpdateCustomPrintTemplate();
  const deleteMutation = useDeleteCustomPrintTemplate();
  const duplicateMutation = useDuplicateCustomPrintTemplate();
  const setDefaultMutation = useSetDefaultCustomPrintTemplate();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomPrintTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPaperSize, setFormPaperSize] = useState<'A4' | 'A5'>('A4');
  const [formBranchId, setFormBranchId] = useState<string>('all');
  const [formMarginTop, setFormMarginTop] = useState(10);
  const [formMarginBottom, setFormMarginBottom] = useState(10);
  const [formMarginLeft, setFormMarginLeft] = useState(10);
  const [formMarginRight, setFormMarginRight] = useState(10);
  const [formScale, setFormScale] = useState(100);

  const resetForm = () => {
    setFormName('');
    setFormPaperSize('A4');
    setFormBranchId('all');
    setFormMarginTop(10);
    setFormMarginBottom(10);
    setFormMarginLeft(10);
    setFormMarginRight(10);
    setFormScale(100);
  };

  const openCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const openEdit = (t: CustomPrintTemplate) => {
    setFormName(t.name);
    setFormPaperSize(t.paper_size);
    setFormBranchId(t.branch_id || 'all');
    setFormMarginTop(t.margin_top);
    setFormMarginBottom(t.margin_bottom);
    setFormMarginLeft(t.margin_left);
    setFormMarginRight(t.margin_right);
    setFormScale(t.scale_percent);
    setEditingTemplate(t);
  };

  const handleCreate = () => {
    createMutation.mutate(
      {
        name: formName || 'Mẫu mới',
        paper_size: formPaperSize,
        branch_id: formBranchId === 'all' ? null : formBranchId,
        margin_top: formMarginTop,
        margin_bottom: formMarginBottom,
        margin_left: formMarginLeft,
        margin_right: formMarginRight,
        scale_percent: formScale,
      },
      { onSuccess: () => setShowCreateDialog(false) }
    );
  };

  const handleUpdate = () => {
    if (!editingTemplate) return;
    updateMutation.mutate(
      {
        id: editingTemplate.id,
        name: formName,
        paper_size: formPaperSize,
        branch_id: formBranchId === 'all' ? null : formBranchId,
        margin_top: formMarginTop,
        margin_bottom: formMarginBottom,
        margin_left: formMarginLeft,
        margin_right: formMarginRight,
        scale_percent: formScale,
      },
      { onSuccess: () => setEditingTemplate(null) }
    );
  };

  const handleToggleActive = (t: CustomPrintTemplate) => {
    updateMutation.mutate({ id: t.id, is_active: !t.is_active });
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return 'Tất cả';
    return branches.find((b) => b.id === branchId)?.name || 'N/A';
  };

  const formDialog = (
    isOpen: boolean,
    onClose: () => void,
    title: string,
    onSave: () => void,
    saving: boolean
  ) => (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tên mẫu</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="VD: Mẫu A4 điện thoại" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Khổ giấy</Label>
              <Select value={formPaperSize} onValueChange={(v) => setFormPaperSize(v as 'A4' | 'A5')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 (210×297mm)</SelectItem>
                  <SelectItem value="A5">A5 (148×210mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chi nhánh</Label>
              <Select value={formBranchId} onValueChange={setFormBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Lề giấy (mm)</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              <div>
                <Label className="text-xs">Trên</Label>
                <Input type="number" value={formMarginTop} onChange={(e) => setFormMarginTop(+e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Dưới</Label>
                <Input type="number" value={formMarginBottom} onChange={(e) => setFormMarginBottom(+e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Trái</Label>
                <Input type="number" value={formMarginLeft} onChange={(e) => setFormMarginLeft(+e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Phải</Label>
                <Input type="number" value={formMarginRight} onChange={(e) => setFormMarginRight(+e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <Label>Tỉ lệ in (%)</Label>
            <Input type="number" value={formScale} onChange={(e) => setFormScale(+e.target.value)} min={50} max={150} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Mẫu in tuỳ chỉnh (A4/A5)</h3>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Tạo mẫu
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Đang tải...</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Chưa có mẫu in tuỳ chỉnh nào.</p>
            <Button variant="outline" className="mt-3" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Tạo mẫu đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id} className={!t.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{t.name}</span>
                      <Badge variant="outline" className="text-xs">{t.paper_size}</Badge>
                      {t.is_default && (
                        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                          <Star className="h-3 w-3 mr-0.5" /> Mặc định
                        </Badge>
                      )}
                      {!t.is_active && (
                        <Badge variant="secondary" className="text-xs">Tắt</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Chi nhánh: {getBranchName(t.branch_id)} · Lề: {t.margin_top}/{t.margin_bottom}/{t.margin_left}/{t.margin_right}mm · Tỉ lệ: {t.scale_percent}%
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={() => handleToggleActive(t)}
                      aria-label="Bật/tắt mẫu"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4 mr-2" /> Sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateMutation.mutate(t)}>
                          <Copy className="h-4 w-4 mr-2" /> Nhân bản
                        </DropdownMenuItem>
                        {!t.is_default && (
                          <DropdownMenuItem onClick={() => setDefaultMutation.mutate({ id: t.id, tenantId: t.tenant_id })}>
                            <Star className="h-4 w-4 mr-2" /> Đặt mặc định
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(t.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Xoá
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      {formDialog(showCreateDialog, () => setShowCreateDialog(false), 'Tạo mẫu in mới', handleCreate, createMutation.isPending)}

      {/* Edit dialog */}
      {formDialog(!!editingTemplate, () => setEditingTemplate(null), 'Sửa mẫu in', handleUpdate, updateMutation.isPending)}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá mẫu in?</AlertDialogTitle>
            <AlertDialogDescription>Mẫu in sẽ bị xoá vĩnh viễn. Bạn có chắc chắn?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
              }}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
