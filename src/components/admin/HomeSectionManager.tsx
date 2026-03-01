import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, ChevronDown, RotateCcw, Sparkles, Plus, Pencil, Trash2, X, Package } from 'lucide-react';
import { HomeSection, getIndustryConfig } from '@/lib/industryConfig';

export interface HomeSectionItem {
  id: HomeSection | string; // string for custom tab IDs like "productTab_xxx"
  enabled: boolean;
}

export interface CustomProductTab {
  id: string;
  name: string;
  displayStyle: 'grid' | 'slide' | 'list';
  enabled: boolean;
  icon?: string;
}

// All available built-in sections with labels and icons
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

// Preset tab templates
const PRESET_TABS: { name: string; icon: string }[] = [
  { name: 'Sản phẩm bán chạy', icon: '🔥' },
  { name: 'Sản phẩm Sale', icon: '🏷️' },
  { name: 'Sản phẩm mới', icon: '✨' },
  { name: 'Flash Sale', icon: '⚡' },
];

function getSectionMeta(id: string, customTabs: CustomProductTab[]) {
  const customTab = customTabs.find(t => t.id === id);
  if (customTab) {
    return { id, label: customTab.name, icon: customTab.icon || '📦', description: `Tab sản phẩm tùy chỉnh • ${customTab.displayStyle === 'grid' ? 'Lưới' : customTab.displayStyle === 'slide' ? 'Trượt' : 'Danh sách'}` };
  }
  return ALL_SECTIONS.find(s => s.id === id) || { id, label: id, icon: '📦', description: '' };
}

interface HomeSectionManagerProps {
  templateId: string;
  customSections: HomeSectionItem[] | null;
  onChange: (sections: HomeSectionItem[] | null) => void;
  customProductTabs?: CustomProductTab[];
  onTabsChange?: (tabs: CustomProductTab[]) => void;
  onManageTabProducts?: (tabId: string, tabName: string) => void;
}

export function HomeSectionManager({ templateId, customSections, onChange, customProductTabs = [], onTabsChange, onManageTabProducts }: HomeSectionManagerProps) {
  const config = getIndustryConfig(templateId);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState('');
  const [showCustomCreate, setShowCustomCreate] = useState(false);

  // Build current items: custom or from config defaults
  const buildFromConfig = (): HomeSectionItem[] => {
    const configSections = config.homeSections;
    const items: HomeSectionItem[] = configSections.map(id => ({ id, enabled: true }));
    ALL_SECTIONS.forEach(s => {
      if (!items.find(i => i.id === s.id)) {
        items.push({ id: s.id, enabled: false });
      }
    });
    // Add existing custom product tabs
    customProductTabs.forEach(tab => {
      if (!items.find(i => i.id === tab.id)) {
        items.push({ id: tab.id, enabled: tab.enabled });
      }
    });
    return items;
  };

  const currentItems = customSections || buildFromConfig();

  const handleToggle = (index: number) => {
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
  const handleAutoSuggest = () => onChange(buildFromConfig());

  // Add a custom product tab
  const addProductTab = (name: string, icon?: string) => {
    const tabId = `productTab_${Date.now()}`;
    const newTab: CustomProductTab = { id: tabId, name, displayStyle: 'grid', enabled: true, icon: icon || '📦' };
    const updatedTabs = [...customProductTabs, newTab];
    onTabsChange?.(updatedTabs);

    // Also add to home sections
    const updatedSections = [...currentItems, { id: tabId, enabled: true }];
    onChange(updatedSections);
    setShowAddMenu(false);
    setShowCustomCreate(false);
    setNewTabName('');
  };

  const removeProductTab = (tabId: string) => {
    const updatedTabs = customProductTabs.filter(t => t.id !== tabId);
    onTabsChange?.(updatedTabs);
    const updatedSections = currentItems.filter(s => s.id !== tabId);
    onChange(updatedSections);
  };

  const updateTabName = (tabId: string, name: string) => {
    const updatedTabs = customProductTabs.map(t => t.id === tabId ? { ...t, name } : t);
    onTabsChange?.(updatedTabs);
  };

  const updateTabDisplayStyle = (tabId: string, displayStyle: 'grid' | 'slide' | 'list') => {
    const updatedTabs = customProductTabs.map(t => t.id === tabId ? { ...t, displayStyle } : t);
    onTabsChange?.(updatedTabs);
  };

  const isCustomTab = (id: string) => id.startsWith('productTab_');

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
          const meta = getSectionMeta(item.id, customProductTabs);
          const isHero = item.id === 'hero';
          const isCustom = isCustomTab(item.id);
          const isEditing = editingTabId === item.id;

          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-lg border p-2.5 transition-all ${
                item.enabled ? 'bg-background' : 'bg-muted/40 opacity-60'
              }`}
            >
              {/* Move buttons */}
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

              {/* Icon */}
              <span className="text-lg shrink-0">{meta.icon}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={customProductTabs.find(t => t.id === item.id)?.name || ''}
                      onChange={e => updateTabName(item.id, e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                    <Select
                      value={customProductTabs.find(t => t.id === item.id)?.displayStyle || 'grid'}
                      onValueChange={v => updateTabDisplayStyle(item.id, v as any)}
                    >
                      <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Lưới</SelectItem>
                        <SelectItem value="slide">Trượt</SelectItem>
                        <SelectItem value="list">DS</SelectItem>
                      </SelectContent>
                    </Select>
                    <button type="button" onClick={() => setEditingTabId(null)} className="h-6 w-6 shrink-0 flex items-center justify-center rounded hover:bg-muted">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium leading-tight">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{meta.description}</p>
                  </>
                )}
              </div>

              {/* Actions for custom tabs */}
              {isCustom && !isEditing && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {onManageTabProducts && (
                    <button type="button" onClick={() => onManageTabProducts(item.id, meta.label)}
                      className="h-6 px-1.5 flex items-center justify-center gap-0.5 rounded hover:bg-primary/10 text-primary text-[10px] font-medium">
                      <Package className="h-3 w-3" />
                      SP
                    </button>
                  )}
                  <button type="button" onClick={() => setEditingTabId(item.id)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => removeProductTab(item.id)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}

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
            <p className="text-xs font-medium">Chọn loại bố cục</p>
            <button type="button" onClick={() => { setShowAddMenu(false); setShowCustomCreate(false); }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </div>
          
          {/* Preset tabs */}
          <div className="space-y-1">
            {PRESET_TABS.map(preset => {
              const alreadyAdded = customProductTabs.some(t => t.name === preset.name);
              return (
                <button
                  key={preset.name}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addProductTab(preset.name, preset.icon)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{preset.icon}</span>
                  <span>{preset.name}</span>
                  {alreadyAdded && <span className="text-muted-foreground ml-auto">Đã thêm</span>}
                </button>
              );
            })}
          </div>

          {/* Custom create */}
          {!showCustomCreate ? (
            <button
              type="button"
              onClick={() => setShowCustomCreate(true)}
              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted transition-colors flex items-center gap-2 text-primary font-medium"
            >
              <Plus className="h-3 w-3" />
              Tự tạo bố cục mới
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={newTabName}
                onChange={e => setNewTabName(e.target.value)}
                placeholder="Tên tab (VD: Phụ kiện hot)"
                className="h-8 text-xs flex-1"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && newTabName.trim()) addProductTab(newTabName.trim()); }}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={!newTabName.trim()}
                onClick={() => addProductTab(newTabName.trim())}
              >
                Thêm
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        💡 Kéo lên/xuống để thay đổi thứ tự. Bấm "Thêm bố cục" để tạo tab sản phẩm riêng.
      </p>
    </div>
  );
}
