import { useState, useEffect } from 'react';
import { Star, Send, Loader2, CheckCircle, User, Gift, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatNumber';

const SUGGESTION_TAGS = [
  'Nhiệt tình',
  'Thân thiện',
  'Chuyên nghiệp',
  'Tư vấn tốt',
  'Nhanh nhẹn',
  'Kiên nhẫn',
  'Am hiểu sản phẩm',
];

interface StaffRatingFormProps {
  staffName: string;
  staffUserId: string;
  tenantId: string;
  branchId: string | null;
  exportReceiptItemId: string;
  primaryColor: string;
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
  customerId?: string | null;
  reviewRewardPoints?: number;
  onPointsAwarded?: (pointsAdded: number, newBalance: number) => void;
}

export function StaffRatingForm({
  staffName,
  staffUserId,
  tenantId,
  branchId,
  exportReceiptItemId,
  primaryColor,
  defaultCustomerName = '',
  defaultCustomerPhone = '',
  customerId,
  reviewRewardPoints = 0,
  onPointsAwarded,
}: StaffRatingFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [content, setContent] = useState('');
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [showThankYou, setShowThankYou] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Check if review already exists using secure RPC
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const { data } = await supabase.rpc('check_review_exists' as any, {
          _export_receipt_item_id: exportReceiptItemId,
          _tenant_id: tenantId,
        });

        if (data && data.length > 0) {
          setRating(data[0].rating);
          setIsSubmitted(true);
          setShowThankYou(false);
        }
      } catch (err) {
        console.error('Check existing review error:', err);
      } finally {
        setCheckingExisting(false);
      }
    };
    checkExisting();
  }, [exportReceiptItemId, tenantId]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    setContent(prev => {
      const currentTags = prev.split('. ').filter(Boolean);
      if (currentTags.includes(tag)) {
        return currentTags.filter(t => t !== tag).join('. ');
      } else {
        return [...currentTags, tag].join('. ');
      }
    });
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Vui lòng chọn số sao đánh giá');
      return;
    }

    setIsSubmitting(true);
    try {
      // Use secure RPC that validates data server-side and awards points atomically
      const { data: result, error } = await supabase.rpc('submit_staff_review' as any, {
        _tenant_id: tenantId,
        _branch_id: branchId,
        _staff_user_id: staffUserId,
        _customer_name: customerName.trim() || '',
        _customer_phone: customerPhone.trim() || '',
        _rating: rating,
        _content: content.trim() || '',
        _export_receipt_item_id: exportReceiptItemId,
        _customer_id: customerId || null,
      });

      if (error) throw error;

      const pointsAdded = result?.points_added || 0;
      if (pointsAdded > 0) {
        setPointsEarned(pointsAdded);
        onPointsAwarded?.(pointsAdded, result?.new_balance || 0);
      }

      setIsSubmitted(true);
      setShowThankYou(true);
    } catch (err: any) {
      console.error('Submit review error:', err);
      if (err?.message?.includes('already exists')) {
        toast.error('Sản phẩm này đã được đánh giá trước đó.');
        setIsSubmitted(true);
      } else {
        toast.error('Không thể gửi đánh giá. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingExisting) {
    return null;
  }

  // Thank you screen with points
  if (isSubmitted && showThankYou) {
    return (
      <div className="mt-3 p-5 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 text-center space-y-3">
        <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
        <p className="text-sm font-semibold text-green-800">
          Cảm ơn bạn đã đánh giá nhân viên {staffName}!
        </p>
        <div className="flex justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <Star
              key={i}
              className="h-5 w-5"
              fill={i <= rating ? '#f59e0b' : 'none'}
              stroke={i <= rating ? '#f59e0b' : '#d1d5db'}
            />
          ))}
        </div>

        {pointsEarned > 0 && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-amber-100 border border-amber-200">
            <Gift className="h-5 w-5 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              Bạn nhận được <span className="text-lg font-bold text-amber-600">{formatNumber(pointsEarned)}</span> điểm tích lũy
            </p>
          </div>
        )}

        <Button
          variant="outline"
          className="mt-2"
          onClick={() => setShowThankYou(false)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Xong
        </Button>
      </div>
    );
  }

  // Compact submitted state
  if (isSubmitted && !showThankYou) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200 text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-xs font-medium text-green-800">Đã đánh giá {staffName}</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
              <Star
                key={i}
                className="h-3 w-3"
                fill={i <= rating ? '#f59e0b' : 'none'}
                stroke={i <= rating ? '#f59e0b' : '#d1d5db'}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-full" style={{ backgroundColor: `${primaryColor}15` }}>
          <User className="h-4 w-4" style={{ color: primaryColor }} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Nhân viên tư vấn</p>
          <p className="font-semibold text-sm" style={{ color: primaryColor }}>{staffName}</p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">Đánh giá nhân viên:</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              type="button"
              className="p-0.5 transition-transform hover:scale-110 active:scale-95"
              onMouseEnter={() => setHoveredStar(i)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRating(i)}
            >
              <Star
                className="h-7 w-7 transition-colors"
                fill={(hoveredStar || rating) >= i ? '#f59e0b' : 'none'}
                stroke={(hoveredStar || rating) >= i ? '#f59e0b' : '#d1d5db'}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-xs text-amber-600 self-center ml-1">
              {rating === 1 ? 'Kém' : rating === 2 ? 'TB' : rating === 3 ? 'Khá' : rating === 4 ? 'Tốt' : 'Xuất sắc'}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Gợi ý (nhấn để điền vào nội dung):</p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTION_TAGS.map(tag => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
              className="cursor-pointer text-xs px-2.5 py-1 transition-colors"
              style={selectedTags.includes(tag) ? { backgroundColor: primaryColor } : {}}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <Textarea
        placeholder="Nhận xét thêm (tùy chọn)..."
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={2}
        className="text-sm bg-white"
      />

      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Tên của bạn"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          className="text-sm h-9 bg-white"
        />
        <Input
          placeholder="SĐT (tùy chọn)"
          value={customerPhone}
          onChange={e => setCustomerPhone(e.target.value)}
          className="text-sm h-9 bg-white"
          inputMode="tel"
        />
      </div>

      {reviewRewardPoints > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <Gift className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Gửi đánh giá để nhận <span className="font-bold">{formatNumber(reviewRewardPoints)} điểm</span> tích lũy
          </p>
        </div>
      )}

      <Button
        className="w-full h-10 text-sm"
        style={{ backgroundColor: primaryColor }}
        onClick={handleSubmit}
        disabled={rating === 0 || isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Gửi đánh giá
      </Button>
    </div>
  );
}
