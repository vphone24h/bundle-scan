import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';

export interface ProductDetailSectionItem {
  id: string;
  enabled: boolean;
}

const ALL_DETAIL_SECTIONS: { id: string; label: string; icon: string; description: string }[] = [
  { id: 'installment', label: 'Nút trả góp', icon: '💳', description: 'Hiển thị nút tính trả góp' },
  { id: 'compare', label: 'So sánh sản phẩm', icon: '⚖️', description: 'So sánh với sản phẩm khác' },
  { id: 'tradeIn', label: 'Thu cũ đổi mới', icon: '🔄', description: 'Chương trình thu cũ đổi mới' },
  { id: 'promotion', label: 'Khung khuyến mãi', icon: '🎁', description: 'Ưu đãi, quà tặng kèm' },
  { id: 'warranty', label: 'Khung bảo hành', icon: '🛡️', description: 'Chính sách bảo hành' },
  { id: 'description', label: 'Mô tả sản phẩm', icon: '📝', description: 'Nội dung chi tiết sản phẩm' },
  { id: 'relatedProducts', label: 'Sản phẩm liên quan', icon: '📦', description: 'SP cùng danh mục' },
  { id: 'reviews', label: 'Đánh giá khách hàng', icon: '💬', description: 'Đánh giá & nhận xét' },
  { id: 'recentlyViewed', label: 'Đã xem gần đây', icon: '👁️', description: 'Sản phẩm khách vừa xem' },
  { id: 'storeInfo', label: 'Thông tin cửa hàng', icon: '📞', description: 'Liên hệ, hotline' },
];

function getDefaultSections(): ProductDetailSectionItem[] {
  return [
    { id: 'installment', enabled: true },
    { id: 'compare', enabled: false },
    { id: 'tradeIn', enabled: false },
    { id: 'promotion', enabled: true },
    { id: 'warranty', enabled: true },
    { id: 'description', enabled: true },
    { id: 'relatedProducts', enabled: true },
    { id: 'reviews', enabled: false },
    { id: 'recentlyViewed', enabled: false },
    { id: 'storeInfo', enabled: false },
  ];
}

// Migrate old sections that don't have new items
export function migrateSections(sections: ProductDetailSectionItem[]): ProductDetailSectionItem[] {
  const ids = sections.map(s => s.id);
  const newItems: ProductDetailSectionItem[] = [];
  
  // Add missing new feature items at the beginning
  if (!ids.includes('installment')) newItems.push({ id: 'installment', enabled: true });
  if (!ids.includes('compare')) newItems.push({ id: 'compare', enabled: false });
  if (!ids.includes('tradeIn')) newItems.push({ id: 'tradeIn', enabled: false });
  
  if (newItems.length > 0) {
    return [...newItems, ...sections];
  }
  return sections;
}

interface ProductDetailSectionManagerProps {
  customSections: ProductDetailSectionItem[] | null;
  onChange: (sections: ProductDetailSectionItem[] | null) => void;
}

export function ProductDetailSectionManager({ customSections, onChange }: ProductDetailSectionManagerProps) {
  const rawItems = customSections || getDefaultSections();
  const currentItems = migrateSections(rawItems);

  const handleToggle = (index: number) => {
    const updated = [...currentItems];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...currentItems];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= currentItems.length - 1) return;
    const updated = [...currentItems];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  const handleReset = () => onChange(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {customSections && (
          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Mặc định
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {currentItems.map((item, i) => {
          const meta = ALL_DETAIL_SECTIONS.find(s => s.id === item.id) || { label: item.id, icon: '📦', description: '' };
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-lg border p-2.5 transition-all ${
                item.enabled ? 'bg-background' : 'bg-muted/40 opacity-60'
              }`}
            >
              <div className="flex flex-col gap-0.5 shrink-0">
                <button type="button" onClick={() => handleMoveUp(i)} disabled={i === 0}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => handleMoveDown(i)} disabled={i === currentItems.length - 1}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              <span className="text-lg shrink-0">{meta.icon}</span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{meta.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{meta.description}</p>
              </div>

              <Switch checked={item.enabled} onCheckedChange={() => handleToggle(i)} className="shrink-0" />
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        💡 Kéo lên/xuống để thay đổi thứ tự hiển thị. Các phần này nằm bên dưới giá & biến thể sản phẩm.
      </p>
    </div>
  );
}
