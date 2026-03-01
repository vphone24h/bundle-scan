import { useState } from 'react';
import { NavItemConfig, PageItemConfig, InstallmentRateConfig, DEFAULT_INSTALLMENT_RATES, getIndustryConfig, getDefaultNavItems, getFullNavItems, INDUSTRY_SUGGESTED_NAV, SYSTEM_PAGES, DEFAULT_PAGE_ITEMS, type IndustryConfig } from '@/lib/industryConfig';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X, Trash2, ChevronUp, ChevronDown, Sparkles, Eye, EyeOff, Menu as MenuIcon } from 'lucide-react';

interface NavMenuEditorProps {
  templateId: string;
  customNavItems: NavItemConfig[] | null;
  onChange: (items: NavItemConfig[] | null) => void;
}

export function NavMenuEditor({ templateId, customNavItems, onChange }: NavMenuEditorProps) {
  const config = getIndustryConfig(templateId);
  const defaultItems = getDefaultNavItems(config);
  const suggestedExtras = INDUSTRY_SUGGESTED_NAV[templateId] || [];
  const currentItems = customNavItems || [...defaultItems, ...suggestedExtras];

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuType, setAddMenuType] = useState<'system' | 'link'>('system');

  const isCoreItem = (id: string) => ['home', 'products', 'news', 'warranty'].includes(id);

  const handleToggle = (index: number) => {
    const updated = [...currentItems];
    if (updated[index].id === 'home') return;
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    onChange(updated);
  };

  const handleLabelChange = (index: number, label: string) => {
    const updated = [...currentItems];
    updated[index] = { ...updated[index], label };
    onChange(updated);
  };

  const handleUrlChange = (index: number, url: string) => {
    const updated = [...currentItems];
    updated[index] = { ...updated[index], url };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const item = currentItems[index];
    if (isCoreItem(item.id)) return;
    const updated = currentItems.filter((_, i) => i !== index);
    onChange(updated);
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const handleAddSystemPage = (pageDef: typeof SYSTEM_PAGES[number]) => {
    const defaultItems_page = DEFAULT_PAGE_ITEMS[pageDef.id];
    const newItem: NavItemConfig = {
      id: pageDef.id + '_' + Date.now(),
      label: pageDef.label,
      enabled: true,
      type: 'page',
      pageView: pageDef.id,
      icon: pageDef.icon,
      pageItems: defaultItems_page ? [...defaultItems_page] : undefined,
    };
    onChange([...currentItems, newItem]);
    setShowAddMenu(false);
  };

  const handleAddCustomLink = () => {
    const newItem: NavItemConfig = {
      id: `custom_${Date.now()}`,
      label: 'Trang mới',
      enabled: true,
      type: 'link',
      icon: '📄',
      url: '',
    };
    onChange([...currentItems, newItem]);
    setShowAddMenu(false);
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

  const handleAutoSuggest = () => onChange(getFullNavItems(templateId));
  const handleReset = () => onChange(null);

  // Page items handlers
  const handlePageItemChange = (navIndex: number, itemIndex: number, field: keyof PageItemConfig, value: string) => {
    const updated = [...currentItems];
    const pageView = updated[navIndex].pageView || '';
    const defaults = DEFAULT_PAGE_ITEMS[pageView] || [];
    const items = updated[navIndex].pageItems ? [...updated[navIndex].pageItems!] : [...defaults];
    items[itemIndex] = { ...items[itemIndex], [field]: value };
    updated[navIndex] = { ...updated[navIndex], pageItems: items };
    onChange(updated);
  };

  const handleAddPageItem = (navIndex: number) => {
    const updated = [...currentItems];
    const pageView = updated[navIndex].pageView || '';
    const defaults = DEFAULT_PAGE_ITEMS[pageView] || [];
    const items = updated[navIndex].pageItems ? [...updated[navIndex].pageItems!] : [...defaults];
    items.push({ title: 'Mục mới', desc: '', icon: '📌', price: '' });
    updated[navIndex] = { ...updated[navIndex], pageItems: items };
    onChange(updated);
  };

  const handleRemovePageItem = (navIndex: number, itemIndex: number) => {
    const updated = [...currentItems];
    const pageView = updated[navIndex].pageView || '';
    const defaults = DEFAULT_PAGE_ITEMS[pageView] || [];
    const items = updated[navIndex].pageItems ? [...updated[navIndex].pageItems!] : [...defaults];
    items.splice(itemIndex, 1);
    updated[navIndex] = { ...updated[navIndex], pageItems: items };
    onChange(updated);
  };

  const handleResetPageItems = (navIndex: number) => {
    const updated = [...currentItems];
    updated[navIndex] = { ...updated[navIndex], pageItems: undefined };
    onChange(updated);
  };

  const handleInstallmentRateChange = (navIndex: number, rateIndex: number, field: keyof InstallmentRateConfig, value: string | number | boolean) => {
    const updated = [...currentItems];
    const rates = updated[navIndex].installmentRates ? [...updated[navIndex].installmentRates!] : [...DEFAULT_INSTALLMENT_RATES];
    rates[rateIndex] = { ...rates[rateIndex], [field]: value };
    updated[navIndex] = { ...updated[navIndex], installmentRates: rates };
    onChange(updated);
  };

  const handleAddInstallmentRate = (navIndex: number) => {
    const updated = [...currentItems];
    const rates = updated[navIndex].installmentRates ? [...updated[navIndex].installmentRates!] : [...DEFAULT_INSTALLMENT_RATES];
    rates.push({ label: 'Ngân hàng mới', rate: 2.0 });
    updated[navIndex] = { ...updated[navIndex], installmentRates: rates };
    onChange(updated);
  };

  const handleRemoveInstallmentRate = (navIndex: number, rateIndex: number) => {
    const updated = [...currentItems];
    const rates = updated[navIndex].installmentRates ? [...updated[navIndex].installmentRates!] : [...DEFAULT_INSTALLMENT_RATES];
    rates.splice(rateIndex, 1);
    updated[navIndex] = { ...updated[navIndex], installmentRates: rates };
    onChange(updated);
  };

  const handleResetInstallmentRates = (navIndex: number) => {
    const updated = [...currentItems];
    updated[navIndex] = { ...updated[navIndex], installmentRates: undefined };
    onChange(updated);
  };

  const hasEditableItems = (item: NavItemConfig) => {
    if (item.type !== 'page') return false;
    const pv = item.pageView || '';
    return !!DEFAULT_PAGE_ITEMS[pv] || (item.pageItems && item.pageItems.length > 0) || pv === 'installment';
  };

  return (
    <div className="space-y-3">
      {/* Auto-suggest button */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleAutoSuggest}>
          <Sparkles className="h-3.5 w-3.5" />
          Gợi ý menu theo ngành
        </Button>
        {customNavItems && (
          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={handleReset}>
            Khôi phục mặc định
          </Button>
        )}
      </div>

      {/* Nav items list */}
      <div className="space-y-2">
        {currentItems.map((item, i) => {
          const isExpanded = expandedIndex === i;
          const canEditItems = hasEditableItems(item);
          const pageView = item.pageView || '';
          const defaults = DEFAULT_PAGE_ITEMS[pageView] || [];
          const currentPageItems = item.pageItems || defaults;

          return (
            <div key={item.id + i} className="rounded-lg border transition-all overflow-hidden">
              <div className={`flex items-center gap-2 p-2.5 ${item.enabled ? 'bg-background' : 'bg-muted/50 opacity-60'}`}>
                {/* Order buttons */}
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

                <span className="text-lg shrink-0">{item.icon || '📄'}</span>

                <div className="flex-1 min-w-0 space-y-1">
                  <Input value={item.label} onChange={(e) => handleLabelChange(i, e.target.value)}
                    className="h-8 text-sm font-medium" placeholder="Tên menu" />
                  {item.type === 'link' && !isCoreItem(item.id) && (
                    <Input value={item.url || ''} onChange={(e) => handleUrlChange(i, e.target.value)}
                      className="h-7 text-xs" placeholder="URL (VD: https://...)" />
                  )}
                </div>

                <span className="text-[10px] text-muted-foreground shrink-0">
                  {isCoreItem(item.id) ? 'Mặc định' : item.type === 'page' ? 'Trang HT' : 'Link ngoài'}
                </span>

                {canEditItems && (
                  <button type="button" onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    title="Chỉnh sửa nội dung trang">
                    <MenuIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}

                <button type="button" onClick={() => handleToggle(i)} disabled={item.id === 'home'}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
                  title={item.enabled ? 'Ẩn' : 'Hiện'}>
                  {item.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </button>

                {!isCoreItem(item.id) && (
                  <button type="button" onClick={() => handleRemove(i)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Expanded page items editor */}
              {isExpanded && canEditItems && (
                <div className="border-t bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Nội dung trang ({currentPageItems.length} mục)</Label>
                    <div className="flex gap-1">
                      {item.pageItems && (
                        <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => handleResetPageItems(i)}>
                          Mặc định
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => handleAddPageItem(i)}>
                        <Plus className="h-3 w-3 mr-1" /> Thêm
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {currentPageItems.map((pi, j) => (
                      <div key={j} className="flex items-start gap-1.5 rounded-md border bg-background p-2">
                        <Input value={pi.icon || ''} onChange={(e) => handlePageItemChange(i, j, 'icon', e.target.value)}
                          className="h-7 w-10 text-center text-sm p-0 shrink-0" placeholder="📌" maxLength={4} />
                        <div className="flex-1 min-w-0 space-y-1">
                          <Input value={pi.title} onChange={(e) => handlePageItemChange(i, j, 'title', e.target.value)}
                            className="h-7 text-xs font-medium" placeholder="Tên dịch vụ" />
                          <Input value={pi.desc || ''} onChange={(e) => handlePageItemChange(i, j, 'desc', e.target.value)}
                            className="h-6 text-[11px]" placeholder="Mô tả ngắn" />
                          <div className="flex gap-1">
                            {(pageView === 'repair' || pageView === 'pricelist') && (
                              <Input value={pi.price || ''} onChange={(e) => handlePageItemChange(i, j, 'price', e.target.value)}
                                className="h-6 text-[11px] w-24" placeholder="Giá" />
                            )}
                            <Input value={pi.link || ''} onChange={(e) => handlePageItemChange(i, j, 'link', e.target.value)}
                              className="h-6 text-[11px] flex-1" placeholder="Link bài viết, SP, FB, Zalo..." />
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemovePageItem(i, j)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Installment rates editor */}
                  {pageView === 'installment' && (() => {
                    const currentRates = item.installmentRates || DEFAULT_INSTALLMENT_RATES;
                    return (
                      <div className="border-t pt-3 mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">💰 Lãi suất ngân hàng ({currentRates.length})</Label>
                          <div className="flex gap-1">
                            {item.installmentRates && (
                              <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => handleResetInstallmentRates(i)}>
                                Mặc định
                              </Button>
                            )}
                            <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => handleAddInstallmentRate(i)}>
                              <Plus className="h-3 w-3 mr-1" /> Thêm NH
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {currentRates.map((rt, ri) => (
                            <div key={ri} className={`flex items-center gap-1.5 rounded-md border p-2 ${rt.isBadCredit ? 'border-orange-300 bg-orange-50' : 'bg-background'}`}>
                              <Input value={rt.label} onChange={(e) => handleInstallmentRateChange(i, ri, 'label', e.target.value)}
                                className="h-7 text-xs font-medium flex-1" placeholder="Tên ngân hàng" />
                              <div className="flex items-center gap-1 shrink-0">
                                <Input value={rt.rate} onChange={(e) => handleInstallmentRateChange(i, ri, 'rate', parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs w-16 text-right" placeholder="1.83" type="number" step="0.01" min="0" />
                                <span className="text-[10px] text-muted-foreground">%</span>
                              </div>
                              <label className="flex items-center gap-1 shrink-0" title="Nợ xấu">
                                <input type="checkbox" checked={!!rt.isBadCredit}
                                  onChange={(e) => handleInstallmentRateChange(i, ri, 'isBadCredit', e.target.checked)}
                                  className="h-3 w-3 rounded" />
                                <span className="text-[10px]">⚠️</span>
                              </label>
                              <button type="button" onClick={() => handleRemoveInstallmentRate(i, ri)}
                                className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Lãi suất %/tháng. Đánh dấu ⚠️ cho mục "Góp nợ xấu".</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new item */}
      {!showAddMenu ? (
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={() => setShowAddMenu(true)}>
          <Plus className="h-3.5 w-3.5" />
          Thêm trang mới
        </Button>
      ) : (
        <div className="rounded-xl border p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Chọn loại nội dung</Label>
            <button type="button" onClick={() => setShowAddMenu(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setAddMenuType('system')}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${addMenuType === 'system' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
              📄 Trang hệ thống
            </button>
            <button type="button" onClick={() => setAddMenuType('link')}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${addMenuType === 'link' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
              🔗 Link tuỳ chỉnh
            </button>
          </div>
          {addMenuType === 'system' ? (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {SYSTEM_PAGES.filter(p => !['home', 'products', 'news', 'warranty'].includes(p.id)).map(page => {
                const alreadyAdded = currentItems.some(it => it.pageView === page.id || it.id === page.id);
                return (
                  <button key={page.id} type="button" disabled={alreadyAdded} onClick={() => handleAddSystemPage(page)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent'}`}>
                    <span>{page.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{page.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{page.description}</span>
                    </div>
                    {alreadyAdded && <span className="text-[10px] text-muted-foreground">Đã thêm</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={handleAddCustomLink}>
              <Plus className="h-3.5 w-3.5" /> Thêm link tuỳ chỉnh
            </Button>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        💡 "Trang HT" = Trang hệ thống tự tạo nội dung (không cần URL). "Link ngoài" = liên kết đến trang bất kỳ.
      </p>
    </div>
  );
}
