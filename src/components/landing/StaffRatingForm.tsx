import { useState } from 'react';
import { Star, Send, Loader2, CheckCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

export function StaffRatingForm({
  staffName,
  staffUserId,
  tenantId,
  branchId,
  exportReceiptItemId,
  primaryColor,
}: StaffRatingFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [content, setContent] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Vui lòng chọn số sao đánh giá');
      return;
    }

    setIsSubmitting(true);
    try {
      // Combine tags + custom content
      const fullContent = [
        ...selectedTags,
        content.trim(),
      ].filter(Boolean).join('. ');

      const { error } = await supabase
        .from('staff_reviews' as any)
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          staff_user_id: staffUserId,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          rating,
          content: fullContent || null,
          export_receipt_item_id: exportReceiptItemId,
        });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success('Cảm ơn bạn đã đánh giá!');
    } catch (err) {
      console.error('Submit review error:', err);
      toast.error('Không thể gửi đánh giá. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="mt-3 p-4 rounded-xl bg-green-50 border border-green-200 text-center space-y-2">
        <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
        <p className="text-sm font-medium text-green-800">
          Cảm ơn bạn đã đánh giá nhân viên {staffName}!
        </p>
        <div className="flex justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <Star
              key={i}
              className="h-4 w-4"
              fill={i <= rating ? '#f59e0b' : 'none'}
              stroke={i <= rating ? '#f59e0b' : '#d1d5db'}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 space-y-3">
      {/* Staff info */}
      <div className="flex items-center gap-2">
        <div
          className="p-2 rounded-full"
          style={{ backgroundColor: `${primaryColor}15` }}
        >
          <User className="h-4 w-4" style={{ color: primaryColor }} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Nhân viên tư vấn</p>
          <p className="font-semibold text-sm" style={{ color: primaryColor }}>
            {staffName}
          </p>
        </div>
      </div>

      {/* Star Rating */}
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

      {/* Suggestion Tags */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Gợi ý:</p>
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

      {/* Content */}
      <Textarea
        placeholder="Nhận xét thêm (tùy chọn)..."
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={2}
        className="text-sm bg-white"
      />

      {/* Customer info */}
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

      {/* Submit */}
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
