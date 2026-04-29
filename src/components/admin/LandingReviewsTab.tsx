import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Star, Pencil, Trash2, Eye, EyeOff, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useAdminProductReviews,
  useUpdateProductReview,
  useDeleteProductReview,
  type LandingProductReview,
} from '@/hooks/useLandingProductReviews';

function StarsView({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

function StarsPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button type="button" key={i} onClick={() => onChange(i)}>
          <Star className={`h-5 w-5 ${i <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

export function LandingReviewsTab() {
  const { toast } = useToast();
  const { data: reviews = [], isLoading } = useAdminProductReviews();
  const updateReview = useUpdateProductReview();
  const deleteReview = useDeleteProductReview();

  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'real' | 'fake'>('all');
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ customer_name: '', customer_phone: '', content: '', rating: 5, is_visible: true });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r: any) => {
      if (ratingFilter !== 'all' && r.rating !== ratingFilter) return false;
      if (typeFilter === 'fake' && !r.is_fake) return false;
      if (typeFilter === 'real' && r.is_fake) return false;
      if (!q) return true;
      return (
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.customer_phone || '').includes(q) ||
        (r.content || '').toLowerCase().includes(q) ||
        (r.landing_products?.name || '').toLowerCase().includes(q)
      );
    });
  }, [reviews, search, ratingFilter, typeFilter]);

  const counts = useMemo(() => {
    const byStar: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let real = 0, fake = 0;
    reviews.forEach((r: any) => {
      byStar[r.rating] = (byStar[r.rating] || 0) + 1;
      if (r.is_fake) fake++; else real++;
    });
    return { byStar, real, fake };
  }, [reviews]);

  const openEdit = (r: any) => {
    setEditing(r);
    setEditForm({
      customer_name: r.customer_name || '',
      customer_phone: r.customer_phone || '',
      content: r.content || '',
      rating: r.rating || 5,
      is_visible: r.is_visible !== false,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateReview.mutateAsync({ id: editing.id, ...editForm });
      toast({ title: '✅ Đã cập nhật đánh giá' });
      setEditing(null);
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e?.message, variant: 'destructive' });
    }
  };

  const toggleVisible = async (r: any) => {
    try {
      await updateReview.mutateAsync({ id: r.id, is_visible: !r.is_visible });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e?.message, variant: 'destructive' });
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteReview.mutateAsync(confirmDelete);
      toast({ title: '🗑️ Đã xoá đánh giá' });
      setConfirmDelete(null);
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên khách, SĐT, sản phẩm, nội dung..."
            className="pl-8"
          />
        </div>
        <Badge variant="secondary">{filtered.length} đánh giá</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={ratingFilter === 'all' ? 'default' : 'outline'}
          className="h-7 px-2 text-xs"
          onClick={() => setRatingFilter('all')}
        >
          Tất cả ({reviews.length})
        </Button>
        {([5, 4, 3, 2, 1] as const).map(s => (
          <Button
            key={s}
            size="sm"
            variant={ratingFilter === s ? 'default' : 'outline'}
            className="h-7 px-2 text-xs gap-0.5"
            onClick={() => setRatingFilter(s)}
          >
            {s}<Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-muted-foreground ml-0.5">({counts.byStar[s] || 0})</span>
          </Button>
        ))}
        <span className="mx-1 text-muted-foreground">|</span>
        <Button
          size="sm"
          variant={typeFilter === 'all' ? 'default' : 'outline'}
          className="h-7 px-2 text-xs"
          onClick={() => setTypeFilter('all')}
        >
          Tất cả loại
        </Button>
        <Button
          size="sm"
          variant={typeFilter === 'real' ? 'default' : 'outline'}
          className="h-7 px-2 text-xs"
          onClick={() => setTypeFilter('real')}
        >
          Thật ({counts.real})
        </Button>
        <Button
          size="sm"
          variant={typeFilter === 'fake' ? 'default' : 'outline'}
          className="h-7 px-2 text-xs"
          onClick={() => setTypeFilter('fake')}
        >
          Ảo ({counts.fake})
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Chưa có đánh giá nào.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r: any) => (
            <Card key={r.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{r.customer_name}</span>
                    <span className="text-xs text-muted-foreground">{r.customer_phone}</span>
                    <StarsView value={r.rating} />
                    {r.is_fake && <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">Ảo</Badge>}
                    {!r.is_visible && <Badge variant="outline" className="text-[10px]">Đã ẩn</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    📦 {r.landing_products?.name || '(Sản phẩm đã xoá)'}
                    {' • '}
                    {new Date(r.created_at).toLocaleString('vi-VN')}
                  </p>
                  <p className="text-sm whitespace-pre-wrap break-words">{r.content}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleVisible(r)} title={r.is_visible ? 'Ẩn' : 'Hiện'}>
                    {r.is_visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Sửa">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(r.id)} title="Xoá">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sửa đánh giá</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Họ tên</Label>
              <Input value={editForm.customer_name} onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">SĐT</Label>
              <Input value={editForm.customer_phone} onChange={e => setEditForm(f => ({ ...f, customer_phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Số sao</Label>
              <StarsPicker value={editForm.rating} onChange={v => setEditForm(f => ({ ...f, rating: v }))} />
            </div>
            <div>
              <Label className="text-xs">Nội dung</Label>
              <Textarea rows={4} value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Hiển thị công khai</Label>
              <Switch checked={editForm.is_visible} onCheckedChange={v => setEditForm(f => ({ ...f, is_visible: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Huỷ</Button>
            <Button onClick={saveEdit} disabled={updateReview.isPending}>
              {updateReview.isPending ? 'Đang lưu...' : 'Cập nhật'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá đánh giá này?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground">Xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}