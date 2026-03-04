import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChevronUp, ChevronDown, RotateCcw, Plus, Trash2, X } from 'lucide-react';
import { SYSTEM_PAGES } from '@/lib/industryConfig';

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

const EXTRA_LAYOUT_PRESETS = SYSTEM_PAGES
  .filter(p => !['home', 'products', 'news', 'warranty'].includes(p.id))
  .filter(p => !ALL_DETAIL_SECTIONS.some(s => s.id === p.id));

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

function getSectionMeta(id: string) {
  if (id.startsWith('layout_')) {
    const pageId = id.replace(/^layout_\d+_/, '').replace(/^layout_/, '');
    const page = SYSTEM_PAGES.find(p => p.id === pageId);
    if (page) return { label: page.label, icon: page.icon, description: page.description };
  }
  return ALL_DETAIL_SECTIONS.find(s => s.id === id) || { label: id, icon: '📦', description: '' };
}

interface ProductDetailSectionManagerProps {
  customSections: ProductDetailSectionItem[] | null;
  onChange: (sections: ProductDetailSectionItem[] | null) => void;
}

export function ProductDetailSectionManager({ customSections, onChange }: ProductDetailSectionManagerProps) {
  const rawItems = customSections || getDefaultSections();
  const currentItems = migrateSections(rawItems);
  const [showAddMenu, setShowAddMenu] = useState(false);

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

  const isLayoutSection = (id: string) => id.startsWith('layout_');

  const addLayoutSection = (pageId: string) => {
    const sectionId = `layout_${Date.now()}_${pageId}`;
    onChange([...currentItems, { id: sectionId, enabled: true }]);
    setShowAddMenu(false);
  };

  const removeLayoutSection = (sectionId: string) => {
    onChange(currentItems.filter(s => s.id !== sectionId));
  };

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
          const meta = getSectionMeta(item.id);
          const isLayout = isLayoutSection(item.id);
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

              {isLayout && (
                <button type="button" onClick={() => removeLayoutSection(item.id)}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}

              <Switch checked={item.enabled} onCheckedChange={() => handleToggle(i)} className="shrink-0" />
            </div>
          );
        })}
      </div>

      {/* Add Layout Button */}
      {!showAddMenu ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs border-dashed"
          onClick={() => setShowAddMenu(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm bố cục
        </Button>
      ) : (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Chọn trang chức năng</p>
            <button type="button" onClick={() => setShowAddMenu(false)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {EXTRA_LAYOUT_PRESETS.map(page => {
              const alreadyAdded = currentItems.some(it => it.id.includes(`_${page.id}`));
              return (
                <button
                  key={page.id}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addLayoutSection(page.id)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{page.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{page.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{page.description}</span>
                  </div>
                  {alreadyAdded && <span className="text-muted-foreground text-[10px]">Đã thêm</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        💡 Kéo lên/xuống để thay đổi thứ tự hiển thị. Các phần này nằm bên dưới giá & biến thể sản phẩm.
      </p>
    </div>
  );
}