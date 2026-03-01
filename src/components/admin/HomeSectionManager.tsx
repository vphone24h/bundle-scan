import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChevronUp, ChevronDown, RotateCcw, Sparkles } from 'lucide-react';
import { HomeSection, getIndustryConfig } from '@/lib/industryConfig';

export interface HomeSectionItem {
  id: HomeSection;
  enabled: boolean;
}

// All available sections with labels and icons
const ALL_SECTIONS: { id: HomeSection; label: string; icon: string; description: string }[] = [
  { id: 'hero', label: 'Banner chính', icon: '🎯', description: 'Banner quảng cáo lớn đầu trang' },
  { id: 'trustBadges', label: 'Cam kết uy tín', icon: '🛡️', description: '4 biểu tượng cam kết' },
  { id: 'flashSale', label: 'Flash Sale', icon: '⚡', description: 'Sản phẩm giảm giá sốc' },
  { id: 'categories', label: 'Danh mục', icon: '📂', description: 'Danh mục sản phẩm' },
  { id: 'featuredProducts', label: 'Sản phẩm nổi bật', icon: '⭐', description: 'Sản phẩm/dịch vụ chính' },
  { id: 'combo', label: 'Combo / Bundle', icon: '🎁', description: 'Gói sản phẩm ưu đãi' },
  { id: 'articles', label: 'Bài viết / Tin tức', icon: '📰', description: 'Blog, tin tức, review' },
  { id: 'warranty', label: 'Tra cứu bảo hành', icon: '🔍', description: 'Khách nhập IMEI/SĐT tra cứu' },
  { id: 'voucher', label: 'Voucher', icon: '🎟️', description: 'Phát voucher cho khách' },
  { id: 'reviews', label: 'Đánh giá khách hàng', icon: '💬', description: 'Đánh giá & nhận xét' },
  { id: 'branches', label: 'Chi nhánh', icon: '📍', description: 'Danh sách chi nhánh' },
  { id: 'storeInfo', label: 'Thông tin liên hệ', icon: '📞', description: 'Địa chỉ, SĐT, email' },
];

function getSectionMeta(id: HomeSection) {
  return ALL_SECTIONS.find(s => s.id === id) || { id, label: id, icon: '📦', description: '' };
}

interface HomeSectionManagerProps {
  templateId: string;
  customSections: HomeSectionItem[] | null;
  onChange: (sections: HomeSectionItem[] | null) => void;
}

export function HomeSectionManager({ templateId, customSections, onChange }: HomeSectionManagerProps) {
  const config = getIndustryConfig(templateId);

  // Build current items: custom or from config defaults
  const buildFromConfig = (): HomeSectionItem[] => {
    const configSections = config.homeSections;
    // Start with config sections (enabled)
    const items: HomeSectionItem[] = configSections.map(id => ({ id, enabled: true }));
    // Add remaining sections as disabled
    ALL_SECTIONS.forEach(s => {
      if (!items.find(i => i.id === s.id)) {
        items.push({ id: s.id, enabled: false });
      }
    });
    return items;
  };

  const currentItems = customSections || buildFromConfig();

  const handleToggle = (index: number) => {
    // Hero should always be enabled
    if (currentItems[index].id === 'hero') return;
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

  const handleAutoSuggest = () => {
    onChange(buildFromConfig());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleAutoSuggest}>
          <Sparkles className="h-3.5 w-3.5" />
          Gợi ý theo ngành
        </Button>
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
          const isHero = item.id === 'hero';

          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-lg border p-2.5 transition-all ${
                item.enabled ? 'bg-background' : 'bg-muted/40 opacity-60'
              }`}
            >
              {/* Move buttons */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveUp(i)}
                  disabled={i === 0}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(i)}
                  disabled={i === currentItems.length - 1}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* Icon */}
              <span className="text-lg shrink-0">{meta.icon}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{meta.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{meta.description}</p>
              </div>

              {/* Toggle */}
              <Switch
                checked={item.enabled}
                onCheckedChange={() => handleToggle(i)}
                disabled={isHero}
                className="shrink-0"
              />
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        💡 Kéo lên/xuống để thay đổi thứ tự hiển thị. Tắt/bật để ẩn/hiện các mục trên trang chủ.
      </p>
    </div>
  );
}
