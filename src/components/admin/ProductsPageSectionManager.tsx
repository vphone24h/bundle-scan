import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, ChevronDown, RotateCcw, Plus, Pencil, Trash2, X, Package } from 'lucide-react';
import { CustomProductTab } from '@/components/admin/HomeSectionManager';
import { SYSTEM_PAGES } from '@/lib/industryConfig';

export interface ProductsPageSectionItem {
  id: string;
  enabled: boolean;
}

const PRODUCTS_PAGE_SECTIONS: { id: string; label: string; icon: string; description: string }[] = [
  { id: 'search', label: 'Thanh tìm kiếm', icon: '🔍', description: 'Tìm kiếm sản phẩm' },
  { id: 'categoryFilter', label: 'Bộ lọc danh mục', icon: '📂', description: 'Lọc theo danh mục' },
  { id: 'allProducts', label: 'Tất cả sản phẩm', icon: '📦', description: 'Hiển thị toàn bộ sản phẩm' },
  { id: 'featuredProducts', label: 'Sản phẩm nổi bật', icon: '⭐', description: 'Sản phẩm được đánh dấu nổi bật' },
  { id: 'flashSale', label: 'Flash Sale', icon: '⚡', description: 'Sản phẩm giảm giá sốc' },
  { id: 'combo', label: 'Combo / Bundle', icon: '🎁', description: 'Gói sản phẩm ưu đãi' },
  { id: 'reviews', label: 'Đánh giá khách hàng', icon: '💬', description: 'Đánh giá & nhận xét' },
];

const PRESET_TABS: { name: string; icon: string }[] = [
  { name: 'Sản phẩm bán chạy', icon: '🔥' },
  { name: 'Sản phẩm Sale', icon: '🏷️' },
  { name: 'Sản phẩm mới', icon: '✨' },
  { name: 'Hàng trưng bày', icon: '🏬' },
];

const EXTRA_LAYOUT_PRESETS = SYSTEM_PAGES
  .filter(p => !['home', 'products', 'news', 'warranty'].includes(p.id))
  .filter(p => !PRODUCTS_PAGE_SECTIONS.some(s => s.id === p.id));

function getSectionMeta(id: string, customTabs: CustomProductTab[]) {
  const customTab = customTabs.find(t => t.id === id);
  if (customTab) {
    return { label: customTab.name, icon: customTab.icon || '📦', description: `Tab sản phẩm • ${customTab.displayStyle === 'grid' ? 'Lưới' : customTab.displayStyle === 'slide' ? 'Trượt' : 'Danh sách'}` };
  }
  if (id.startsWith('layout_')) {
    const pageId = id.replace(/^layout_\d+_/, '').replace(/^layout_/, '');
    const page = SYSTEM_PAGES.find(p => p.id === pageId);
    if (page) return { label: page.label, icon: page.icon, description: page.description };
  }
  const section = PRODUCTS_PAGE_SECTIONS.find(s => s.id === id);
  return section || { label: id, icon: '📦', description: '' };
}

function getDefaultSections(): ProductsPageSectionItem[] {
  return [
    { id: 'search', enabled: true },
    { id: 'categoryFilter', enabled: true },
    { id: 'allProducts', enabled: true },
  ];
}

interface ProductsPageSectionManagerProps {
  customSections: ProductsPageSectionItem[] | null;
  onChange: (sections: ProductsPageSectionItem[] | null) => void;
  customProductTabs?: CustomProductTab[];
  onTabsChange?: (tabs: CustomProductTab[]) => void;
  onManageTabProducts?: (tabId: string, tabName: string) => void;
}

export function ProductsPageSectionManager({ customSections, onChange, customProductTabs = [], onTabsChange, onManageTabProducts }: ProductsPageSectionManagerProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState('');
  const [showCustomCreate, setShowCustomCreate] = useState(false);
  const [addMenuTab, setAddMenuTab] = useState<'product' | 'layout'>('product');

  const buildDefault = (): ProductsPageSectionItem[] => {
    const items = getDefaultSections();
    PRODUCTS_PAGE_SECTIONS.forEach(s => {
      if (!items.find(i => i.id === s.id)) items.push({ id: s.id, enabled: false });
    });
    customProductTabs.forEach(tab => {
      if (!items.find(i => i.id === tab.id)) items.push({ id: tab.id, enabled: tab.enabled });
    });
    return items;
  };

  const currentItems = customSections || buildDefault();

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

  const isCustomTab = (id: string) => id.startsWith('ppTab_');
  const isLayoutSection = (id: string) => id.startsWith('layout_');

  const addProductTab = (name: string, icon?: string) => {
    const tabId = `ppTab_${Date.now()}`;
    const newTab: CustomProductTab = { id: tabId, name, displayStyle: 'grid', enabled: true, icon: icon || '📦' };
    const updatedTabs = [...customProductTabs, newTab];
    onTabsChange?.(updatedTabs);
    const updatedSections = [...currentItems, { id: tabId, enabled: true }];
    onChange(updatedSections);
    setShowAddMenu(false);
    setShowCustomCreate(false);
    setNewTabName('');
  };

  const addLayoutSection = (pageId: string) => {
    const sectionId = `layout_${Date.now()}_${pageId}`;
    onChange([...currentItems, { id: sectionId, enabled: true }]);
    setShowAddMenu(false);
  };

  const removeProductTab = (tabId: string) => {
    onTabsChange?.(customProductTabs.filter(t => t.id !== tabId));
    onChange(currentItems.filter(s => s.id !== tabId));
  };

  const removeLayoutSection = (sectionId: string) => {
    onChange(currentItems.filter(s => s.id !== sectionId));
  };

  const updateTabName = (tabId: string, name: string) => {
    onTabsChange?.(customProductTabs.map(t => t.id === tabId ? { ...t, name } : t));
  };

  const updateTabDisplayStyle = (tabId: string, displayStyle: 'grid' | 'slide' | 'list') => {
    onTabsChange?.(customProductTabs.map(t => t.id === tabId ? { ...t, displayStyle } : t));
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
          const meta = getSectionMeta(item.id, customProductTabs);
          const isCustom = isCustomTab(item.id);
          const isLayout = isLayoutSection(item.id);
          const isEditing = editingTabId === item.id;

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

      {!showAddMenu ? (
        <Button
          type="button" variant="outline" size="sm"
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
            <button type="button" onClick={() => { setShowAddMenu(false); setShowCustomCreate(false); setAddMenuTab('product'); }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="flex gap-1">
            <button type="button" onClick={() => setAddMenuTab('product')}
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${addMenuTab === 'product' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
              📦 Tab sản phẩm
            </button>
            <button type="button" onClick={() => setAddMenuTab('layout')}
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${addMenuTab === 'layout' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
              📄 Trang chức năng
            </button>
          </div>

          {addMenuTab === 'product' ? (
            <>
              <div className="space-y-1">
                {PRESET_TABS.map(preset => {
                  const alreadyAdded = customProductTabs.some(t => t.name === preset.name);
                  return (
                    <button
                      key={preset.name} type="button" disabled={alreadyAdded}
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
              {!showCustomCreate ? (
                <button type="button" onClick={() => setShowCustomCreate(true)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted transition-colors flex items-center gap-2 text-primary font-medium">
                  <Plus className="h-3 w-3" />
                  Tự tạo bố cục mới
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={newTabName} onChange={e => setNewTabName(e.target.value)}
                    placeholder="Tên tab (VD: Phụ kiện hot)" className="h-8 text-xs flex-1" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && newTabName.trim()) addProductTab(newTabName.trim()); }}
                  />
                  <Button type="button" size="sm" className="h-8 text-xs" disabled={!newTabName.trim()}
                    onClick={() => addProductTab(newTabName.trim())}>
                    Thêm
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {EXTRA_LAYOUT_PRESETS.map(page => {
                const alreadyAdded = currentItems.some(it => it.id.includes(`_${page.id}`));
                return (
                  <button
                    key={page.id} type="button" disabled={alreadyAdded}
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
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        💡 Kéo lên/xuống để thay đổi thứ tự. Bấm "Thêm bố cục" để tạo tab sản phẩm hoặc trang chức năng.
      </p>
    </div>
  );
}