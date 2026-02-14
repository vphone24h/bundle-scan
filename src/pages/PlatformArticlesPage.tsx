import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, FolderOpen } from 'lucide-react';
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

  const filtered = filterCat === 'all'
    ? articles
    : articles.filter((a) => a.category_id === filterCat);

  const getCatName = (catId: string | null) => categories.find((c) => c.id === catId)?.name;

  return (
    <MainLayout>
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
                  onClick={() => setSelectedArticle(article)}
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
      </div>

      {/* Article detail dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedArticle?.title}</DialogTitle>
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
              dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
            />
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
