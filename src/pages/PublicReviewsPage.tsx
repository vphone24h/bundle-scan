import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, ArrowLeft, MessageSquareQuote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import vkhoLogo from '@/assets/vkho-logo.png';

interface PublicReview {
  id: string;
  customer_name: string | null;
  rating: number;
  content: string | null;
  created_at: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

export default function PublicReviewsPage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const { data, error } = await supabase.rpc('get_public_reviews', { _limit: 100 });
        if (!error && data) {
          setReviews(data as PublicReview[]);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <img src={vkhoLogo} alt="vkho.vn" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
            <div>
              <span className="font-bold text-base sm:text-lg text-primary">vkho.vn</span>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground -mt-1">Quản lý thông minh</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1 as any)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquareQuote className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Đánh giá từ khách hàng</h1>
          </div>
          <p className="text-muted-foreground mb-8">
            Tất cả đánh giá từ khách hàng đang sử dụng dịch vụ của chúng tôi
          </p>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Chưa có đánh giá nào.</div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => {
                const displayName = review.customer_name || 'Khách hàng';
                const initials = displayName.split(' ').map(w => w[0]).join('').slice(-2).toUpperCase();

                return (
                  <Card key={review.id}>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground">{displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: vi })}
                          </p>
                        </div>
                        <StarRating rating={review.rating} />
                      </div>
                      {review.content && (
                        <p className="text-sm text-muted-foreground leading-relaxed">"{review.content}"</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
