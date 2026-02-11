import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, MessageSquareQuote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: vi })}
            </p>
          </div>
          <StarRating rating={review.rating} />
        </div>
        {review.content && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
            "{review.content}"
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface StoreReviewsSectionProps {
  tenantId: string;
  primaryColor: string;
}

export default function StoreReviewsSection({ tenantId, primaryColor }: StoreReviewsSectionProps) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [allReviews, setAllReviews] = useState<PublicReview[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const { data, error } = await supabase.rpc('get_public_reviews', { _limit: 3, _tenant_id: tenantId });
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
  }, [tenantId]);

  const handleShowAll = async () => {
    if (allReviews.length === 0) {
      const { data } = await supabase.rpc('get_public_reviews', { _limit: 100, _tenant_id: tenantId });
      if (data) setAllReviews(data as PublicReview[]);
    }
    setShowAll(true);
  };

  if (loading || reviews.length === 0) return null;

  const displayedReviews = showAll ? (allReviews.length > 0 ? allReviews : reviews) : reviews;

  return (
    <Card className="shadow-md" style={{ borderTop: `3px solid ${primaryColor}` }}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquareQuote className="h-4 w-4" style={{ color: primaryColor }} />
          <h3 className="font-bold text-base">Đánh giá từ khách hàng</h3>
        </div>

        <div className="space-y-3">
          {displayedReviews.map(review => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>

        {!showAll && reviews.length >= 3 && (
          <div className="mt-3 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowAll}
              className="text-xs"
              style={{ color: primaryColor, borderColor: primaryColor }}
            >
              Xem thêm đánh giá
            </Button>
          </div>
        )}

        {showAll && (
          <div className="mt-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(false)}
              className="text-xs"
            >
              Thu gọn
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
