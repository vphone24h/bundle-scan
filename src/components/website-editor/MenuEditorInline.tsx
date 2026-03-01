import { useState } from 'react';
import { NavItemConfig, getFullNavItems, getDefaultNavItems, SYSTEM_PAGES, type IndustryConfig } from '@/lib/industryConfig';
import { TenantLandingSettings } from '@/hooks/useTenantLanding';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';

interface MenuEditorInlineProps {
  formData: Partial<TenantLandingSettings>;
  onChange: (field: string, value: unknown) => void;
  templateId: string;
  config: IndustryConfig;
}

export function MenuEditorInline({ formData, onChange, templateId, config }: MenuEditorInlineProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const customNavItems = (formData as any)?.custom_nav_items as NavItemConfig[] | null;
  const items: NavItemConfig[] = customNavItems || getDefaultNavItems(config);

  const updateItems = (newItems: NavItemConfig[]) => {
    onChange('custom_nav_items', newItems);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const copy = [...items];
    [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
    updateItems(copy);
  };

  const removeItem = (index: number) => {
    const copy = [...items];
    copy.splice(index, 1);
    updateItems(copy);
  };

  const toggleItem = (index: number) => {
    const copy = [...items];
    copy[index] = { ...copy[index], enabled: !copy[index].enabled };
    updateItems(copy);
  };

  const renameItem = (index: number, label: string) => {
    const copy = [...items];
    copy[index] = { ...copy[index], label };
    updateItems(copy);
  };

  const addPageItem = (pageId: string) => {
    const page = SYSTEM_PAGES.find(p => p.id === pageId);
    if (!page) return;
    const newItem: NavItemConfig = {
      id: `nav_${pageId}_${Date.now()}`,
      label: page.label,
      enabled: true,
      type: 'page',
      pageView: page.id,
      icon: page.icon,
    };
    updateItems([...items, newItem]);
    setShowAddMenu(false);
  };

  const addCustomLink = () => {
    const newItem: NavItemConfig = {
      id: `nav_link_${Date.now()}`,
      label: 'Link mới',
      enabled: true,
      type: 'link',
      url: '',
      icon: '🔗',
    };
    updateItems([...items, newItem]);
    setShowAddMenu(false);
  };

  const updateUrl = (index: number, url: string) => {
    const copy = [...items];
    copy[index] = { ...copy[index], url };
    updateItems(copy);
  };

  // Pages not yet in menu
  const usedPageIds = new Set(items.filter(i => i.type === 'page').map(i => i.pageView));
  const availablePages = SYSTEM_PAGES.filter(p => !usedPageIds.has(p.id));

  return (
    <div className="space-y-2">
      {/* Menu items list */}
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div
            key={item.id + idx}
            className={`flex items-center gap-1.5 p-2 rounded-lg border transition-colors ${
              item.enabled ? 'bg-card' : 'bg-muted/40 opacity-60'
            }`}
          >
            {/* Reorder buttons */}
            <div className="flex flex-col shrink-0">
              <button
                type="button"
                onClick={() => moveItem(idx, -1)}
                disabled={idx === 0}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => moveItem(idx, 1)}
                disabled={idx === items.length - 1}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            {/* Icon */}
            <span className="text-sm shrink-0">{item.icon || '📄'}</span>

            {/* Label - editable */}
            <div className="flex-1 min-w-0">
              <Input
                value={item.label}
                onChange={e => renameItem(idx, e.target.value)}
                className="h-7 text-xs border-0 bg-transparent px-1 focus-visible:bg-background focus-visible:border"
              />
              {item.type === 'link' && (
                <Input
                  value={item.url || ''}
                  onChange={e => updateUrl(idx, e.target.value)}
                  placeholder="https://..."
                  className="h-6 text-[10px] border-0 bg-transparent px-1 text-muted-foreground focus-visible:bg-background focus-visible:border mt-0.5"
                />
              )}
            </div>

            {/* Type badge */}
            <span className="text-[9px] text-muted-foreground shrink-0">
              {item.type === 'page' ? 'Trang' : 'Link'}
            </span>

            {/* Toggle visibility */}
            <button
              type="button"
              onClick={() => toggleItem(idx)}
              className={`p-1 rounded text-[9px] shrink-0 ${item.enabled ? 'text-primary' : 'text-muted-foreground'}`}
              title={item.enabled ? 'Ẩn' : 'Hiện'}
            >
              {item.enabled ? '👁' : '👁‍🗨'}
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="p-1 text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add menu */}
      {showAddMenu ? (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-medium">Chọn trang hệ thống:</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
            {availablePages.map(page => (
              <button
                key={page.id}
                type="button"
                onClick={() => addPageItem(page.id)}
                className="flex items-center gap-1.5 p-2 rounded-lg border bg-card hover:bg-accent text-left text-xs"
              >
                <span>{page.icon}</span>
                <span className="truncate">{page.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={addCustomLink}>
              🔗 Link tùy chỉnh
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowAddMenu(false)}>
              Đóng
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => setShowAddMenu(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Thêm menu
        </Button>
      )}

      {/* Suggest */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={() => {
          const fullNav = getFullNavItems(templateId);
          onChange('custom_nav_items', fullNav);
        }}
      >
        <Sparkles className="h-3.5 w-3.5" /> Gợi ý menu theo ngành
      </Button>
    </div>
  );
}
