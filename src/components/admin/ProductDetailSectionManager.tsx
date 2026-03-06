import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, ChevronDown, RotateCcw, Plus, Trash2, X, GripVertical } from 'lucide-react';
import { SYSTEM_PAGES } from '@/lib/industryConfig';

export interface ProductDetailSectionItem {
  id: string;
  enabled: boolean;
}

export interface CTAButtonItem {
  id: string;
  label: string;
  icon: string;
  action: 'order' | 'installment' | 'call' | 'zalo' | 'facebook' | 'booking' | 'custom_link';
  enabled: boolean;
  customUrl?: string;
}

const CTA_ACTION_OPTIONS: { value: CTAButtonItem['action']; label: string; defaultIcon: string; defaultLabel: string }[] = [
  { value: 'order', label: 'Đặt mua / Mua ngay', defaultIcon: '🛒', defaultLabel: 'Đặt mua' },
  { value: 'installment', label: 'Trả góp', defaultIcon: '💳', defaultLabel: 'Trả góp' },
  { value: 'call', label: 'Gọi điện', defaultIcon: '📞', defaultLabel: 'Gọi' },
  { value: 'zalo', label: 'Tư vấn qua Zalo', defaultIcon: '💬', defaultLabel: 'Zalo' },
  { value: 'facebook', label: 'Tư vấn qua Facebook', defaultIcon: '💬', defaultLabel: 'Facebook' },
  { value: 'booking', label: 'Đặt lịch', defaultIcon: '📅', defaultLabel: 'Đặt lịch' },
  { value: 'custom_link', label: 'Link tùy chỉnh', defaultIcon: '🔗', defaultLabel: 'Liên hệ' },
];

export function getDefaultCTAButtons(templateId?: string): CTAButtonItem[] {
  // Default CTA buttons per industry template
  const INDUSTRY_CTA: Record<string, CTAButtonItem[]> = {
    // Technology - bán hàng trực tiếp + trả góp
    phone_store: [
      { id: 'cta_order', label: 'Mua ngay', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_zalo', label: 'Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_fb', label: 'Facebook', icon: '💬', action: 'facebook', enabled: true },
    ],
    laptop_store: [
      { id: 'cta_order', label: 'Mua ngay', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    electronics_store: [
      { id: 'cta_order', label: 'Đặt mua', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    accessories_store: [
      { id: 'cta_order', label: 'Mua ngay', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    apple_landing: [
      { id: 'cta_order', label: 'Mua ngay', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_zalo', label: 'Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_fb', label: 'Facebook', icon: '💬', action: 'facebook', enabled: true },
    ],

    // Fashion & Beauty - mua + tư vấn
    fashion_store: [
      { id: 'cta_order', label: 'Đặt mua', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    shoes_store: [
      { id: 'cta_order', label: 'Đặt mua', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn size', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    cosmetics_store: [
      { id: 'cta_order', label: 'Mua ngay', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn da', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_fb', label: 'Facebook', icon: '💬', action: 'facebook', enabled: true },
    ],
    watch_store: [
      { id: 'cta_order', label: 'Đặt mua', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
    ],
    jewelry_store: [
      { id: 'cta_order', label: 'Đặt mua', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],

    // Spa, Salon - đặt lịch là chính
    spa_store: [
      { id: 'cta_booking', label: 'Đặt lịch', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    salon_store: [
      { id: 'cta_booking', label: 'Đặt lịch', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_zalo', label: 'Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],

    // Food & Beverage - đặt hàng + gọi
    restaurant_store: [
      { id: 'cta_order', label: 'Đặt món', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_booking', label: 'Đặt bàn', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    cafe_store: [
      { id: 'cta_order', label: 'Đặt hàng', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    boba_store: [
      { id: 'cta_order', label: 'Đặt hàng', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],

    // Real Estate & Automotive - tư vấn là chính, không mua trực tiếp
    realestate_store: [
      { id: 'cta_booking', label: 'Đặt lịch xem', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi ngay', icon: '📞', action: 'call', enabled: true },
      { id: 'cta_fb', label: 'Facebook', icon: '💬', action: 'facebook', enabled: true },
    ],
    car_showroom: [
      { id: 'cta_booking', label: 'Đặt lịch lái thử', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
    ],
    motorbike_showroom: [
      { id: 'cta_order', label: 'Đặt xe', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],

    // Home & Construction - báo giá, tư vấn
    furniture_store: [
      { id: 'cta_order', label: 'Đặt mua', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    construction_store: [
      { id: 'cta_order', label: 'Báo giá', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],

    // Hospitality - đặt phòng
    hotel_store: [
      { id: 'cta_booking', label: 'Đặt phòng', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],

    // Services - đặt lịch, tư vấn
    repair_service: [
      { id: 'cta_booking', label: 'Đặt lịch sửa', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_zalo', label: 'Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    training_center: [
      { id: 'cta_booking', label: 'Đăng ký', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    clinic_store: [
      { id: 'cta_booking', label: 'Đặt lịch khám', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    pharmacy_store: [
      { id: 'cta_order', label: 'Đặt mua', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
    company_site: [
      { id: 'cta_booking', label: 'Liên hệ', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_zalo', label: 'Zalo', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],

    // Specialty
    pet_store: [
      { id: 'cta_order', label: 'Đặt mua', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_zalo', label: 'Tư vấn', icon: '💬', action: 'zalo', enabled: true },
      { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
    ],
  };

  if (templateId && INDUSTRY_CTA[templateId]) {
    return INDUSTRY_CTA[templateId];
  }

  // Fallback mặc định cho ngành bán lẻ chung
  return [
    { id: 'cta_order', label: 'Đặt mua', icon: '🛒', action: 'order', enabled: true },
    { id: 'cta_zalo', label: 'Zalo', icon: '💬', action: 'zalo', enabled: true },
    { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
  ];
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

// ===== CTA Buttons Editor =====
interface CTAButtonsEditorProps {
  buttons: CTAButtonItem[] | null;
  onChange: (buttons: CTAButtonItem[] | null) => void;
}

export function CTAButtonsEditor({ buttons, onChange }: CTAButtonsEditorProps) {
  const currentButtons = buttons || getDefaultCTAButtons();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleToggle = (index: number) => {
    const updated = [...currentButtons];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...currentButtons];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= currentButtons.length - 1) return;
    const updated = [...currentButtons];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  const handleAdd = () => {
    const newId = `cta_${Date.now()}`;
    onChange([...currentButtons, {
      id: newId,
      label: 'Nút mới',
      icon: '🔗',
      action: 'custom_link',
      enabled: true,
      customUrl: '',
    }]);
    setEditingId(newId);
  };

  const handleRemove = (index: number) => {
    const updated = currentButtons.filter((_, i) => i !== index);
    onChange(updated.length > 0 ? updated : null);
  };

  const handleUpdate = (index: number, field: string, value: string) => {
    const updated = [...currentButtons];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-update icon & label when action changes
    if (field === 'action') {
      const opt = CTA_ACTION_OPTIONS.find(o => o.value === value);
      if (opt) {
        updated[index].icon = opt.defaultIcon;
        updated[index].label = opt.defaultLabel;
      }
    }
    onChange(updated);
  };

  const handleReset = () => onChange(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Thanh nút hành động (CTA)</p>
        {buttons && (
          <Button type="button" variant="ghost" size="sm" className="text-xs h-6" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" /> Mặc định
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {currentButtons.map((btn, i) => (
          <div key={btn.id}>
            <div className={`flex items-center gap-2 rounded-lg border p-2 transition-all ${btn.enabled ? 'bg-background' : 'bg-muted/40 opacity-60'}`}>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button type="button" onClick={() => handleMoveUp(i)} disabled={i === 0}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => handleMoveDown(i)} disabled={i === currentButtons.length - 1}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              <span className="text-base shrink-0">{btn.icon}</span>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{btn.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {CTA_ACTION_OPTIONS.find(o => o.value === btn.action)?.label || btn.action}
                </p>
              </div>

              <button type="button" onClick={() => setEditingId(editingId === btn.id ? null : btn.id)}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground shrink-0">
                <GripVertical className="h-3.5 w-3.5" />
              </button>

              <button type="button" onClick={() => handleRemove(i)}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="h-3 w-3" />
              </button>

              <Switch checked={btn.enabled} onCheckedChange={() => handleToggle(i)} className="shrink-0" />
            </div>

            {/* Inline edit panel */}
            {editingId === btn.id && (
              <div className="ml-7 mt-1 p-2.5 border rounded-lg bg-muted/20 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Tên nút</Label>
                    <Input className="h-7 text-xs" value={btn.label} onChange={e => handleUpdate(i, 'label', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Icon</Label>
                    <Input className="h-7 text-xs" value={btn.icon} onChange={e => handleUpdate(i, 'icon', e.target.value)} placeholder="🛒" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Hành động</Label>
                  <Select value={btn.action} onValueChange={v => handleUpdate(i, 'action', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CTA_ACTION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(btn.action === 'custom_link' || btn.action === 'zalo' || btn.action === 'facebook') && (
                  <div className="space-y-1">
                    <Label className="text-[10px]">
                      {btn.action === 'zalo' ? 'Link Zalo' : btn.action === 'facebook' ? 'Link Facebook' : 'URL tùy chỉnh'}
                    </Label>
                    <Input className="h-7 text-xs" value={btn.customUrl || ''} onChange={e => handleUpdate(i, 'customUrl', e.target.value)} placeholder="https://..." />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {currentButtons.length < 6 && (
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" /> Thêm nút
        </Button>
      )}

      <p className="text-[10px] text-muted-foreground">
        💡 Tùy chỉnh các nút hành động hiển thị ở cuối trang chi tiết sản phẩm. Tối đa 6 nút.
      </p>
    </div>
  );
}