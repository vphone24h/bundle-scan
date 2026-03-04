import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown, RotateCcw, Plus, Pencil, Trash2, X } from 'lucide-react';

export interface NewsPageSectionItem {
  id: string;
  enabled: boolean;
}

const NEWS_PAGE_SECTIONS: { id: string; label: string; icon: string; description: string }[] = [
  { id: 'search', label: 'Thanh tìm kiếm', icon: '🔍', description: 'Tìm kiếm bài viết' },
  { id: 'categoryFilter', label: 'Bộ lọc danh mục', icon: '📂', description: 'Lọc theo danh mục bài viết' },
  { id: 'featuredArticles', label: 'Bài viết nổi bật', icon: '⭐', description: 'Bài viết được ghim lên đầu' },
  { id: 'allArticles', label: 'Tất cả bài viết', icon: '📰', description: 'Danh sách toàn bộ bài viết' },
  { id: 'latestArticles', label: 'Bài viết mới nhất', icon: '🆕', description: 'Bài viết sắp xếp theo mới nhất' },
  { id: 'popularArticles', label: 'Bài viết phổ biến', icon: '🔥', description: 'Bài viết được xem nhiều nhất' },
];

// Custom section prefix
const CUSTOM_PREFIX = 'newsTab_';

interface CustomNewsTab {
  id: string;
  name: string;
  icon?: string;
}

function getDefaultSections(): NewsPageSectionItem[] {
  return [
    { id: 'search', enabled: true },
    { id: 'categoryFilter', enabled: true },
    { id: 'featuredArticles', enabled: true },
    { id: 'allArticles', enabled: true },
  ];
}

function getSectionMeta(id: string, customTabs: CustomNewsTab[]) {
  const customTab = customTabs.find(t => t.id === id);
  if (customTab) {
    return { label: customTab.name, icon: customTab.icon || '📝', description: 'Danh mục bài viết tùy chỉnh' };
  }
  const section = NEWS_PAGE_SECTIONS.find(s => s.id === id);
  return section || { label: id, icon: '📝', description: '' };
}

const PRESET_NEWS_TABS: { name: string; icon: string }[] = [
  { name: 'Tin công nghệ', icon: '💻' },
  { name: 'Đánh giá sản phẩm', icon: '⭐' },
  { name: 'Mẹo hay', icon: '💡' },
  { name: 'Khuyến mãi', icon: '🎉' },
];

interface NewsPageSectionManagerProps {
  customSections: NewsPageSectionItem[] | null;
  onChange: (sections: NewsPageSectionItem[] | null) => void;
  customNewsTabs?: CustomNewsTab[];
  onTabsChange?: (tabs: CustomNewsTab[]) => void;
}

export function NewsPageSectionManager({
  customSections, onChange, customNewsTabs = [], onTabsChange,
}: NewsPageSectionManagerProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState('');
  const [showCustomCreate, setShowCustomCreate] = useState(false);

  const buildDefault = (): NewsPageSectionItem[] => {
    const items = getDefaultSections();
    NEWS_PAGE_SECTIONS.forEach(s => {
      if (!items.find(i => i.id === s.id)) items.push({ id: s.id, enabled: false });
    });
    customNewsTabs.forEach(tab => {
      if (!items.find(i => i.id === tab.id)) items.push({ id: tab.id, enabled: true });
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

  const isCustomTab = (id: string) => id.startsWith(CUSTOM_PREFIX);

  const addNewsTab = (name: string, icon?: string) => {
    const tabId = `${CUSTOM_PREFIX}${Date.now()}`;
    const newTab: CustomNewsTab = { id: tabId, name, icon: icon || '📝' };
    onTabsChange?.([...customNewsTabs, newTab]);
    onChange([...currentItems, { id: tabId, enabled: true }]);
    setShowAddMenu(false);
    setShowCustomCreate(false);
    setNewTabName('');
  };

  const removeNewsTab = (tabId: string) => {
    onTabsChange?.(customNewsTabs.filter(t => t.id !== tabId));
    onChange(currentItems.filter(s => s.id !== tabId));
  };

  const updateTabName = (tabId: string, name: string) => {
    onTabsChange?.(customNewsTabs.map(t => t.id === tabId ? { ...t, name } : t));
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
          const meta = getSectionMeta(item.id, customNewsTabs);
          const isCustom = isCustomTab(item.id);
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
                      value={customNewsTabs.find(t => t.id === item.id)?.name || ''}
                      onChange={e => updateTabName(item.id, e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
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
                  <button type="button" onClick={() => setEditingTabId(item.id)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => removeNewsTab(item.id)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
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
            <button type="button" onClick={() => { setShowAddMenu(false); setShowCustomCreate(false); }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1">
            {PRESET_NEWS_TABS.map(preset => {
              const alreadyAdded = customNewsTabs.some(t => t.name === preset.name);
              return (
                <button
                  key={preset.name} type="button" disabled={alreadyAdded}
                  onClick={() => addNewsTab(preset.name, preset.icon)}
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
                placeholder="Tên mục (VD: Tin Apple)" className="h-8 text-xs flex-1" autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && newTabName.trim()) addNewsTab(newTabName.trim()); }}
              />
              <Button type="button" size="sm" className="h-8 text-xs" disabled={!newTabName.trim()}
                onClick={() => addNewsTab(newTabName.trim())}>
                Thêm
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        💡 Kéo lên/xuống để thay đổi thứ tự hiển thị trên trang tin tức.
      </p>
    </div>
  );
}
