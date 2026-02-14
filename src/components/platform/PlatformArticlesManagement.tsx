import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { toast } from '@/hooks/use-toast';
import {
  usePlatformArticleCategories,
  useCreatePlatformArticleCategory,
  useUpdatePlatformArticleCategory,
  useDeletePlatformArticleCategory,
  usePlatformArticles,
  useCreatePlatformArticle,
  useUpdatePlatformArticle,
  useDeletePlatformArticle,
  uploadPlatformArticleBanner,
  PlatformArticle,
  PlatformArticleCategory,
} from '@/hooks/usePlatformArticles';
import { Plus, Pencil, Trash2, FolderOpen, FileText, Loader2, Image as ImageIcon } from 'lucide-react';

function CategoryManager() {
  const { data: categories = [], isLoading } = usePlatformArticleCategories();
  const createCat = useCreatePlatformArticleCategory();
  const updateCat = useUpdatePlatformArticleCategory();
  const deleteCat = useDeletePlatformArticleCategory();
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createCat.mutateAsync({ name: newName.trim() });
      setNewName('');
      toast({ title: 'Đã tạo thư mục' });
    } catch {
      toast({ title: 'Lỗi tạo thư mục', variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!editId || !editName.trim()) return;
    try {
      await updateCat.mutateAsync({ id: editId, name: editName.trim() });
      setEditId(null);
      toast({ title: 'Đã cập nhật' });
    } catch {
      toast({ title: 'Lỗi cập nhật', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá thư mục này?')) return;
    try {
      await deleteCat.mutateAsync(id);
      toast({ title: 'Đã xoá' });
    } catch {
      toast({ title: 'Lỗi xoá', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="h-5 w-5" /> Quản lý thư mục
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Tên thư mục mới..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1"
          />
          <Button onClick={handleCreate} disabled={createCat.isPending} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Thêm
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Chưa có thư mục nào</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 p-2 border rounded-lg">
                {editId === cat.id ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 h-8" />
                    <Button size="sm" variant="outline" onClick={handleUpdate}>Lưu</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Huỷ</Button>
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{cat.name}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(cat.id); setEditName(cat.name); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ArticleEditor({ article, categories, onClose }: {
  article: PlatformArticle | null;
  categories: PlatformArticleCategory[];
  onClose: () => void;
}) {
  const createArticle = useCreatePlatformArticle();
  const updateArticle = useUpdatePlatformArticle();
  const [title, setTitle] = useState(article?.title || '');
  const [summary, setSummary] = useState(article?.summary || '');
  const [categoryId, setCategoryId] = useState(article?.category_id || '');
  const [content, setContent] = useState(article?.content || '');
  const [bannerUrl, setBannerUrl] = useState(article?.banner_url || '');
  const [isPublished, setIsPublished] = useState(article?.is_published ?? false);
  const [uploading, setUploading] = useState(false);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPlatformArticleBanner(file);
      setBannerUrl(url);
    } catch {
      toast({ title: 'Lỗi tải ảnh', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Vui lòng nhập tiêu đề', variant: 'destructive' });
      return;
    }
    const payload = {
      title: title.trim(),
      summary: summary.trim() || null,
      category_id: categoryId || null,
      content,
      banner_url: bannerUrl || null,
      is_published: isPublished,
    };
    try {
      if (article) {
        await updateArticle.mutateAsync({ id: article.id, ...payload });
      } else {
        await createArticle.mutateAsync(payload);
      }
      toast({ title: article ? 'Đã cập nhật bài viết' : 'Đã tạo bài viết' });
      onClose();
    } catch {
      toast({ title: 'Lỗi lưu bài viết', variant: 'destructive' });
    }
  };

  const saving = createArticle.isPending || updateArticle.isPending;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? 'Sửa bài viết' : 'Tạo bài viết mới'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tiêu đề *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề bài viết" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Thư mục</Label>
              <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Chọn thư mục" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Không --</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                <Label>Xuất bản</Label>
              </div>
            </div>
          </div>
          <div>
            <Label>Mô tả ngắn</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Tóm tắt nội dung..." rows={2} />
          </div>
          <div>
            <Label>Ảnh banner</Label>
            <div className="flex items-center gap-3 mt-1">
              {bannerUrl && <img src={bannerUrl} alt="Banner" className="h-20 rounded-lg object-cover" />}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ImageIcon className="h-4 w-4 mr-1" />}{bannerUrl ? 'Đổi ảnh' : 'Tải ảnh'}</span>
                </Button>
              </label>
              {bannerUrl && <Button variant="ghost" size="sm" onClick={() => setBannerUrl('')}>Xoá ảnh</Button>}
            </div>
          </div>
          <div>
            <Label>Nội dung</Label>
            <RichTextEditor value={content} onChange={setContent} placeholder="Soạn nội dung bài viết..." minHeight="300px" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {article ? 'Cập nhật' : 'Tạo bài viết'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArticleList() {
  const { data: articles = [], isLoading } = usePlatformArticles();
  const { data: categories = [] } = usePlatformArticleCategories();
  const deleteArticle = useDeletePlatformArticle();
  const [editing, setEditing] = useState<PlatformArticle | null | 'new'>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá bài viết này?')) return;
    try {
      await deleteArticle.mutateAsync(id);
      toast({ title: 'Đã xoá bài viết' });
    } catch {
      toast({ title: 'Lỗi xoá', variant: 'destructive' });
    }
  };

  const getCatName = (catId: string | null) => categories.find((c) => c.id === catId)?.name || '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5" /> Danh sách bài viết
        </CardTitle>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4 mr-1" /> Tạo bài viết
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : articles.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Chưa có bài viết nào</p>
        ) : (
          <div className="space-y-3">
            {articles.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 border rounded-lg">
                {a.banner_url && <img src={a.banner_url} alt="" className="h-16 w-24 rounded object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm truncate">{a.title}</h4>
                    <Badge variant={a.is_published ? 'default' : 'secondary'} className="text-[10px]">
                      {a.is_published ? 'Đã xuất bản' : 'Nháp'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Thư mục: {getCatName(a.category_id)}</p>
                  {a.summary && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.summary}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {editing && (
        <ArticleEditor
          article={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

export function PlatformArticlesManagement() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="articles">
        <TabsList>
          <TabsTrigger value="articles">Bài viết</TabsTrigger>
          <TabsTrigger value="categories">Thư mục</TabsTrigger>
        </TabsList>
        <TabsContent value="articles" className="mt-4">
          <ArticleList />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
