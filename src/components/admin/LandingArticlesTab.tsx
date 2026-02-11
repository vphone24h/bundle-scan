import { useState, useRef } from 'react';
import {
  useLandingArticleCategories,
  useCreateLandingArticleCategory,
  useDeleteLandingArticleCategory,
  useLandingArticles,
  useCreateLandingArticle,
  useUpdateLandingArticle,
  useDeleteLandingArticle,
  uploadLandingArticleImage,
  LandingArticle,
} from '@/hooks/useLandingArticles';
import { useCurrentTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit2, Loader2, Upload, X, FolderPlus, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function LandingArticlesTab() {
  const { data: tenant } = useCurrentTenant();
  const { data: categories, isLoading: catLoading } = useLandingArticleCategories();
  const createCat = useCreateLandingArticleCategory();
  const deleteCat = useDeleteLandingArticleCategory();
  const { data: articles, isLoading: artLoading } = useLandingArticles();
  const createArticle = useCreateLandingArticle();
  const updateArticle = useUpdateLandingArticle();
  const deleteArticle = useDeleteLandingArticle();

  const [catName, setCatName] = useState('');
  const [articleDialog, setArticleDialog] = useState(false);
  const [editingArticle, setEditingArticle] = useState<LandingArticle | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    summary: '',
    content: '',
    category_id: '_none_',
    thumbnail_url: '',
    is_published: false,
    is_featured: false,
  });

  const handleAddCategory = async () => {
    if (!catName.trim()) return;
    try {
      await createCat.mutateAsync({ name: catName.trim() });
      setCatName('');
      toast({ title: 'Đã thêm danh mục' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const openAddArticle = () => {
    setEditingArticle(null);
    setForm({ title: '', summary: '', content: '', category_id: '_none_', thumbnail_url: '', is_published: false, is_featured: false });
    setArticleDialog(true);
  };

  const openEditArticle = (a: LandingArticle) => {
    setEditingArticle(a);
    setForm({
      title: a.title,
      summary: a.summary || '',
      content: a.content || '',
      category_id: a.category_id || '_none_',
      thumbnail_url: a.thumbnail_url || '',
      is_published: a.is_published,
      is_featured: a.is_featured,
    });
    setArticleDialog(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Ảnh không quá 5MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadLandingArticleImage(file, tenant.id);
      setForm(prev => ({ ...prev, thumbnail_url: url }));
    } catch {
      toast({ title: 'Lỗi upload ảnh', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveArticle = async () => {
    if (!form.title.trim()) return;
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary || null,
        content: form.content || null,
        category_id: form.category_id === '_none_' ? null : form.category_id,
        thumbnail_url: form.thumbnail_url || null,
        is_published: form.is_published,
        is_featured: form.is_featured,
      };
      if (editingArticle) {
        await updateArticle.mutateAsync({ id: editingArticle.id, ...payload });
        toast({ title: 'Đã cập nhật bài viết' });
      } else {
        await createArticle.mutateAsync(payload);
        toast({ title: 'Đã thêm bài viết' });
      }
      setArticleDialog(false);
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Xoá bài viết này?')) return;
    try {
      await deleteArticle.mutateAsync(id);
      toast({ title: 'Đã xoá bài viết' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  if (catLoading || artLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Danh mục bài viết */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderPlus className="h-4 w-4" />
            Danh mục bài viết
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={catName}
              onChange={e => setCatName(e.target.value)}
              placeholder="Tên danh mục mới..."
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} disabled={!catName.trim() || createCat.isPending} size="sm">
              {createCat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories?.map(cat => (
              <Badge key={cat.id} variant="secondary" className="gap-1 pr-1">
                {cat.name}
                <button
                  onClick={() => { if (confirm(`Xoá danh mục "${cat.name}"?`)) deleteCat.mutate(cat.id); }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {(!categories || categories.length === 0) && (
              <p className="text-sm text-muted-foreground">Chưa có danh mục nào</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danh sách bài viết */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Bài viết ({articles?.length || 0})
            </CardTitle>
            <Button onClick={openAddArticle} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Thêm bài viết
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {articles && articles.length > 0 ? (
            <div className="space-y-2">
              {articles.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  {a.thumbnail_url ? (
                    <img src={a.thumbnail_url} alt={a.title} className="h-12 w-16 rounded-lg object-cover border" />
                  ) : (
                    <div className="h-12 w-16 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{a.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</span>
                      {!a.is_published && <Badge variant="outline" className="text-[10px]">Nháp</Badge>}
                      {a.is_featured && <Badge variant="default" className="text-[10px]">Nổi bật</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditArticle(a)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteArticle(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Chưa có bài viết nào. Nhấn "Thêm bài viết" để bắt đầu.</p>
          )}
        </CardContent>
      </Card>

      {/* Dialog thêm/sửa bài viết */}
      <Dialog open={articleDialog} onOpenChange={setArticleDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Sửa bài viết' : 'Thêm bài viết mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Tiêu đề *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Tiêu đề bài viết..." />
            </div>
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">Không phân loại</SelectItem>
                  {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tóm tắt</Label>
              <Input value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="Tóm tắt ngắn..." />
            </div>
            <div className="space-y-2">
              <Label>Ảnh đại diện</Label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              {form.thumbnail_url ? (
                <div className="relative inline-block">
                  <img src={form.thumbnail_url} alt="" className="h-24 rounded-lg object-cover border" />
                  <button onClick={() => setForm(p => ({ ...p, thumbnail_url: '' }))} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload ảnh
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Nội dung</Label>
              <RichTextEditor value={form.content} onChange={v => setForm(p => ({ ...p, content: v }))} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Xuất bản</Label>
              <Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Bài viết nổi bật</Label>
              <Switch checked={form.is_featured} onCheckedChange={v => setForm(p => ({ ...p, is_featured: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleDialog(false)}>Huỷ</Button>
            <Button onClick={handleSaveArticle} disabled={!form.title.trim() || createArticle.isPending || updateArticle.isPending}>
              {(createArticle.isPending || updateArticle.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingArticle ? 'Cập nhật' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
