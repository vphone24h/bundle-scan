import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, FolderOpen, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import {
  usePublishedPlatformArticles,
  usePlatformArticleCategories,
  PlatformArticle,
} from '@/hooks/usePlatformArticles';

export default function PlatformArticlesPage() {
  const { data: articles = [], isLoading } = usePublishedPlatformArticles();
  const { data: categories = [] } = usePlatformArticleCategories();
  const [selectedArticle, setSelectedArticle] = useState<PlatformArticle | null>(null);
  const [filterCat, setFilterCat] = useState('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const isPublicRoute = location.pathname === '/public/guides';

  // Deep-link: open article from URL params
  useEffect(() => {
    const articleId = searchParams.get('article');
    if (articleId && articles.length > 0) {
      const a = articles.find(x => x.id === articleId);
      if (a) setSelectedArticle(a);
    }
  }, [searchParams, articles]);

  const filtered = filterCat === 'all'
    ? articles
    : articles.filter((a) => a.category_id === filterCat);

  const getCatName = (catId: string | null) => categories.find((c) => c.id === catId)?.name;

  const copyArticleLink = (articleId: string) => {
    const url = new URL(window.location.origin + '/public/guides');
    url.searchParams.set('article', articleId);
    navigator.clipboard.writeText(url.toString()).then(() => {
      toast.success('Đã sao chép link bài viết');
    }).catch(() => {});
  };

  const handleCloseArticle = () => {
    setSelectedArticle(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('article');
    setSearchParams(newParams, { replace: true });
  };

  const handleOpenArticle = (article: PlatformArticle) => {
    setSelectedArticle(article);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('article', article.id);
    setSearchParams(newParams, { replace: true });
  };

  const content = (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Hướng dẫn & Thông tin"
        description="Các bài viết hướng dẫn sử dụng và thông tin hữu ích"
      />

      {categories.length > 0 && (
        <div className="mt-4 max-w-xs">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger>
              <SelectValue placeholder="Lọc theo thư mục" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Chưa có bài viết nào</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((article) => (
              <Card
                key={article.id}
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                onClick={() => handleOpenArticle(article)}
              >
                {article.banner_url && (
                  <div className="aspect-video w-full overflow-hidden">
                    <img
                      src={article.banner_url}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {getCatName(article.category_id) && (
                      <Badge variant="outline" className="text-[10px]">
                        <FolderOpen className="h-3 w-3 mr-1" />
                        {getCatName(article.category_id)}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2">{article.title}</h3>
                  {article.summary && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{article.summary}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Article detail dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={() => handleCloseArticle()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="text-lg">{selectedArticle?.title}</DialogTitle>
              {selectedArticle && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={() => copyArticleLink(selectedArticle.id)}>
                  <Link2 className="h-3.5 w-3.5" /> Chia sẻ
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedArticle?.banner_url && (
            <img
              src={selectedArticle.banner_url}
              alt={selectedArticle.title}
              className="w-full rounded-lg object-cover max-h-64"
            />
          )}
          {selectedArticle?.summary && (
            <p className="text-sm text-muted-foreground italic">{selectedArticle.summary}</p>
          )}
          {selectedArticle?.content && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedArticle.content) }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // Public route: render without MainLayout (no login required)
  if (isPublicRoute) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-2">
            <img src="/favicon.png" alt="VKHO" className="h-8 w-8" />
            <span className="font-bold text-lg">VKHO</span>
          </div>
        </header>
        <div className="max-w-5xl mx-auto">
          {content}
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      {content}
    </MainLayout>
  );
}
