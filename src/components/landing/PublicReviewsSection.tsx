import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, ArrowRight, MessageSquareQuote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

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

function ReviewCard({ review }: { review: PublicReview }) {
  const displayName = review.customer_name || 'Khách hàng';
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(-2).toUpperCase();

  return (
    <Card className="h-full transition-all hover:shadow-md">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: vi })}
            </p>
          </div>
        </div>
        <StarRating rating={review.rating} />
        {review.content && (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
            "{review.content}"
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PublicReviewsSection() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const { data, error } = await supabase.rpc('get_public_reviews', { _limit: 3 });
        if (!error && data) {
          setReviews(data as PublicReview[]);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, []);

  if (loading || reviews.length === 0) return null;

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 gap-1">
            <MessageSquareQuote className="h-3 w-3" />
            Đánh giá từ khách hàng
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Khách hàng nói gì về chúng tôi?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Những đánh giá thực tế từ khách hàng đang sử dụng vkho.vn
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map(review => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" className="gap-2" onClick={() => navigate('/reviews')}>
            Xem thêm đánh giá
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
