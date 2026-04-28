import { useState } from 'react';
import { Star, MessageSquare, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  usePublicProductReviews,
  useCreateProductReview,
} from '@/hooks/useLandingProductReviews';

interface Props {
  productId: string;
  tenantId: string;
  primaryColor?: string;
}

function StarPicker({ value, onChange, size = 24 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          type="button"
          key={i}
          onClick={() => onChange?.(i)}
          className={onChange ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
          aria-label={`${i} sao`}
        >
          <Star
            style={{ width: size, height: size }}
            className={i <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviewsSection({ productId, tenantId, primaryColor = '#2563eb' }: Props) {
  const { toast } = useToast();
  const { data: reviews = [], isLoading } = usePublicProductReviews(productId);
  const createReview = useCreateProductReview();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(5);

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
    : 0;

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !content.trim()) {
      toast({ title: 'Vui lòng nhập đầy đủ thông tin', variant: 'destructive' });
      return;
    }
    try {
      await createReview.mutateAsync({
        tenant_id: tenantId,
        product_id: productId,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        content: content.trim(),
        rating,
      });
      toast({ title: '✅ Cảm ơn bạn đã đánh giá!' });
      setName(''); setPhone(''); setContent(''); setRating(5);
      setShowForm(false);
    } catch (e: any) {
      toast({ title: 'Lỗi gửi đánh giá', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-3 py-2 font-semibold text-sm bg-muted flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          ĐÁNH GIÁ SẢN PHẨM
          {reviews.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-1">({reviews.length})</span>
          )}
        </span>
        {reviews.length > 0 && (
          <span className="flex items-center gap-1 text-xs">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="font-bold">{avg.toFixed(1)}</span>
            <span className="text-muted-foreground">/ 5</span>
          </span>
        )}
      </div>
      <div className="p-3 space-y-3">
        {/* List */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Đang tải đánh giá...</p>
        ) : reviews.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Chưa có đánh giá. Hãy là người đầu tiên đánh giá sản phẩm này!</p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {reviews.map(r => (
              <div key={r.id} className="border rounded-md p-2.5 bg-background">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{r.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <StarPicker value={r.rating} size={12} />
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap break-words">{r.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        {!showForm ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowForm(true)}
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            <Star className="h-4 w-4 mr-1.5" /> Viết đánh giá
          </Button>
        ) : (
          <div className="space-y-2 border-t pt-3">
            <div>
              <Label className="text-xs">Số sao</Label>
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <div>
              <Label className="text-xs">Họ tên *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <Label className="text-xs">Số điện thoại *</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} placeholder="09xxxxxxxx" />
            </div>
            <div>
              <Label className="text-xs">Nội dung *</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} maxLength={1000} rows={3} placeholder="Chia sẻ trải nghiệm của bạn..." />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Huỷ</Button>
              <Button
                className="flex-1"
                onClick={submit}
                disabled={createReview.isPending}
                style={{ backgroundColor: primaryColor }}
              >
                {createReview.isPending ? 'Đang gửi...' : 'Gửi đánh giá'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}