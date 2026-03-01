import { useState, useMemo } from 'react';
import { TenantLandingSettings } from '@/hooks/useTenantLanding';
import { getIndustryConfig, getFullNavItems, LayoutStyle, HomeSection } from '@/lib/industryConfig';
import { HomeSectionItem, CustomProductTab } from '@/components/admin/HomeSectionManager';
import { Pencil } from 'lucide-react';

interface EditorPreviewTabProps {
  formData: Partial<TenantLandingSettings>;
  deviceMode: 'mobile' | 'tablet' | 'desktop';
  tenant: { id: string; name: string; subdomain: string } | null | undefined;
  onEditSection: (sectionId: string) => void;
}

// Section overlay that shows "Edit" button on tap
function SectionOverlay({
  sectionId,
  label,
  onEdit,
  children,
}: {
  sectionId: string;
  label: string;
  onEdit: (id: string) => void;
  children: React.ReactNode;
}) {
  const [showEdit, setShowEdit] = useState(false);

  return (
    <div
      className="relative group"
      onClick={(e) => {
        e.stopPropagation();
        setShowEdit(!showEdit);
      }}
    >
      {children}
      {/* Hover outline */}
      <div className="absolute inset-0 pointer-events-none border-2 border-transparent group-hover:border-primary/30 transition-colors rounded-sm" />
      {/* Edit button */}
      {showEdit && (
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center z-20 animate-in fade-in duration-150">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(sectionId); }}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-full text-xs font-medium shadow-lg hover:bg-primary/90 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Chỉnh sửa {label}
          </button>
        </div>
      )}
    </div>
  );
}

export function EditorPreviewTab({ formData, deviceMode, tenant, onEditSection }: EditorPreviewTabProps) {
  const templateId = (formData as any)?.website_template || 'phone_store';
  const baseConfig = getIndustryConfig(templateId);
  const customProductTabs: CustomProductTab[] = (formData as any)?.custom_product_tabs || [];

  // Build enabled sections (including custom productTab_* ones)
  const customHomeSections = (formData as any)?.custom_home_sections as HomeSectionItem[] | undefined;
  const enabledSectionIds = useMemo(() => {
    if (customHomeSections) {
      return customHomeSections.filter(s => s.enabled).map(s => s.id);
    }
    return baseConfig.homeSections as string[];
  }, [baseConfig, customHomeSections]);

  // Get category display mode from custom sections
  const categoryDisplayMode = useMemo(() => {
    if (customHomeSections) {
      const catSection = customHomeSections.find(s => s.id === 'categories');
      return catSection?.displayMode || 'horizontal';
    }
    return 'horizontal';
  }, [customHomeSections]);

  const config = useMemo(() => {
    const c = { ...baseConfig };
    if ((formData as any)?.custom_layout_style) c.layoutStyle = (formData as any).custom_layout_style as LayoutStyle;
    if ((formData as any)?.custom_font_family) c.fontFamily = (formData as any).custom_font_family;
    if ((formData as any)?.hero_title) c.heroTitle = (formData as any).hero_title;
    if ((formData as any)?.hero_subtitle) c.heroSubtitle = (formData as any).hero_subtitle;
    if ((formData as any)?.hero_cta) c.heroCta = (formData as any).hero_cta;
    // Keep built-in sections for the config (non-custom ones)
    c.homeSections = enabledSectionIds.filter(id => !id.startsWith('productTab_')) as HomeSection[];
    return c;
  }, [baseConfig, formData, enabledSectionIds]);

  const accentColor = formData.primary_color || config.accentColor;
  const storeName = formData.store_name || tenant?.name || 'Cửa hàng';

  // Device frame dimensions
  const getFrameStyle = () => {
    switch (deviceMode) {
      case 'mobile': return { maxWidth: '390px' };
      case 'tablet': return { maxWidth: '768px' };
      case 'desktop': return { maxWidth: '100%' };
    }
  };

  const getHeroBackground = () => {
    const layout = config.layoutStyle;
    switch (layout) {
      case 'tgdd': return 'linear-gradient(135deg, #ffd700 0%, #ff6b00 100%)';
      case 'hasaki': return 'linear-gradient(135deg, #ff6b81 0%, #ee5a24 50%, #ff4757 100%)';
      case 'nike': case 'canifa': return '#000000';
      case 'luxury': return 'linear-gradient(135deg, #1a1a2e 0%, #0f0f23 50%, #16213e 100%)';
      case 'minimal': return '#faf9f6';
      case 'shopee': return 'linear-gradient(135deg, #ee4d2d 0%, #ff6633 50%, #f53d2d 100%)';
      case 'organic': return 'linear-gradient(135deg, #2d5016 0%, #4a7c2e 50%, #3d6b21 100%)';
      default: return config.heroGradient;
    }
  };

  // Build nav items
  const navItems = (formData as any)?.custom_nav_items || getFullNavItems(templateId);

  return (
    <div className="min-h-full bg-muted/30 flex justify-center pb-4" onClick={() => {}}>
      <div
        className="bg-white shadow-xl mx-auto my-0 sm:my-4 sm:rounded-xl overflow-hidden"
        style={{ ...getFrameStyle(), width: '100%' }}
      >
        {/* Preview: Simulated website */}
        <div className="text-[#1d1d1f]" style={{ fontFamily: config.fontFamily }}>
          {/* HEADER */}
          <SectionOverlay sectionId="store-info" label="Header" onEdit={onEditSection}>
            <header className="border-b border-black/5 bg-white">
              <div className="px-4 flex items-center justify-between h-11">
                <div className="flex items-center gap-2.5">
                  {formData.store_logo_url ? (
                    <img src={formData.store_logo_url} alt="Logo" className="h-7 w-7 rounded-lg object-cover" />
                  ) : (
                    <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-xs">☰</div>
                  )}
                  <span className="font-semibold text-xs tracking-tight">{storeName}</span>
                </div>
                <div className="h-4 w-4 text-[#86868b]">🔍</div>
              </div>
            </header>
          </SectionOverlay>

          {/* MENU / NAV */}
          <SectionOverlay sectionId="menu" label="Menu" onEdit={onEditSection}>
            <nav className="border-b border-black/5 bg-white overflow-x-auto">
              <div className="flex items-center gap-1 px-3 py-2">
                {navItems.slice(0, 6).map((item: any, i: number) => (
                  <span
                    key={i}
                    className="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-medium bg-muted/60 text-foreground/70 whitespace-nowrap"
                  >
                    {item.label || item}
                  </span>
                ))}
              </div>
            </nav>
          </SectionOverlay>

          {/* Render home sections */}
          {enabledSectionIds.map((sectionId) => {
            // Handle custom product tabs
            if (sectionId.startsWith('productTab_')) {
              const tab = customProductTabs.find(t => t.id === sectionId);
              if (!tab) return null;
              return (
                <SectionOverlay key={sectionId} sectionId="layout" label={tab.name} onEdit={onEditSection}>
                  <section className="py-6 bg-white px-4">
                    <h2 className="text-sm font-bold tracking-tight mb-3">{tab.icon || '📦'} {tab.name}</h2>
                    {tab.displayStyle === 'slide' ? (
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="min-w-[150px] rounded-xl border border-black/5 overflow-hidden shrink-0">
                            <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                              <span className="text-2xl opacity-30">📦</span>
                            </div>
                            <div className="p-2.5">
                              <p className="text-[11px] font-medium leading-tight">Sản phẩm {i}</p>
                              <p className="text-[11px] font-bold mt-1" style={{ color: accentColor }}>Liên hệ</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : tab.displayStyle === 'list' ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex gap-3 p-2.5 rounded-xl border border-black/5">
                            <div className="h-16 w-16 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                              <span className="text-lg opacity-30">📦</span>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium">Sản phẩm {i}</p>
                              <p className="text-[11px] font-bold mt-1" style={{ color: accentColor }}>Liên hệ</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="rounded-xl border border-black/5 overflow-hidden">
                            <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                              <span className="text-2xl opacity-30">📦</span>
                            </div>
                            <div className="p-2.5">
                              <p className="text-[11px] font-medium leading-tight">Sản phẩm {i}</p>
                              <p className="text-[11px] font-bold mt-1" style={{ color: accentColor }}>Liên hệ</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </SectionOverlay>
              );
            }

            // Built-in sections
            switch (sectionId) {
              case 'hero':
                return (
                  <SectionOverlay key="hero" sectionId="banner" label="Banner" onEdit={onEditSection}>
                    <section
                      className={`relative overflow-hidden ${config.layoutStyle === 'minimal' ? 'text-stone-800' : 'text-white'}`}
                      style={{ background: getHeroBackground() }}
                    >
                      <div className="px-6 py-10">
                        <h1 className="text-xl font-bold tracking-tight mb-2">{config.heroTitle}</h1>
                        <p className="text-xs mb-4 text-white/70 max-w-xs">{config.heroSubtitle}</p>
                        <button
                          className="rounded-full px-6 py-2 text-xs font-medium text-white"
                          style={{ backgroundColor: accentColor }}
                        >
                          {config.heroCta}
                        </button>
                      </div>
                    </section>
                  </SectionOverlay>
                );

              case 'trustBadges': {
                const badges = (formData as any)?.custom_trust_badges || config.trustBadges;
                return (
                  <SectionOverlay key="trustBadges" sectionId="trust-badges" label="Cam kết" onEdit={onEditSection}>
                    <section className="border-b border-black/5 py-4 px-4">
                      <div className="grid grid-cols-2 gap-2">
                        {badges.slice(0, 4).map((badge: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-xl">
                            <span className="text-sm" style={{ color: accentColor }}>🛡️</span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold leading-tight">{badge.title}</p>
                              <p className="text-[9px] text-[#86868b] leading-tight">{badge.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </SectionOverlay>
                );
              }

              case 'featuredProducts':
                return (
                  <SectionOverlay key="products" sectionId="products" label="Sản phẩm" onEdit={onEditSection}>
                    <section className="py-6 bg-white px-4">
                      <h2 className="text-sm font-bold tracking-tight mb-3">{config.productSectionTitle}</h2>
                      <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="rounded-xl border border-black/5 overflow-hidden">
                            <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                              <span className="text-2xl opacity-30">📦</span>
                            </div>
                            <div className="p-2.5">
                              <p className="text-[11px] font-medium leading-tight">Sản phẩm mẫu {i}</p>
                              <p className="text-[11px] font-bold mt-1" style={{ color: accentColor }}>Liên hệ</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </SectionOverlay>
                );

              case 'articles':
                return (
                  <SectionOverlay key="articles" sectionId="articles" label="Bài viết" onEdit={onEditSection}>
                    <section className="py-6 bg-[#f5f5f7] px-4">
                      <h2 className="text-sm font-bold tracking-tight mb-3">Tin tức & Bài viết</h2>
                      <div className="space-y-3">
                        {[1, 2].map(i => (
                          <div key={i} className="flex gap-3 bg-white rounded-xl p-2.5 border border-black/5">
                            <div className="h-16 w-16 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                              <span className="text-lg opacity-30">📰</span>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium leading-tight">Bài viết mẫu {i}</p>
                              <p className="text-[9px] text-[#86868b] mt-0.5">Mô tả ngắn về bài viết...</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </SectionOverlay>
                );

              case 'warranty':
                return (
                  <SectionOverlay key="warranty" sectionId="warranty" label="Bảo hành" onEdit={onEditSection}>
                    <section className="py-6 px-4 bg-white">
                      <h2 className="text-sm font-bold tracking-tight mb-3">🔍 Tra cứu bảo hành</h2>
                      <div className="flex gap-2">
                        <div className="flex-1 h-10 rounded-lg border border-black/10 bg-[#f5f5f7] px-3 flex items-center">
                          <span className="text-xs text-[#86868b]">Nhập IMEI hoặc SĐT...</span>
                        </div>
                        <div className="h-10 px-4 rounded-lg flex items-center text-white text-xs font-medium" style={{ backgroundColor: accentColor }}>
                          Tra cứu
                        </div>
                      </div>
                    </section>
                  </SectionOverlay>
                );

              case 'voucher':
                return (
                  <SectionOverlay key="voucher" sectionId="voucher" label="Voucher" onEdit={onEditSection}>
                    <section className="py-6 px-4 bg-gradient-to-r from-amber-50 to-orange-50">
                      <h2 className="text-sm font-bold tracking-tight mb-2">🎟️ Nhận Voucher</h2>
                      <p className="text-[10px] text-[#86868b]">Nhập SĐT để nhận ưu đãi đặc biệt</p>
                    </section>
                  </SectionOverlay>
                );

              case 'reviews':
                return (
                  <SectionOverlay key="reviews" sectionId="reviews" label="Đánh giá" onEdit={onEditSection}>
                    <section className="py-6 px-4 bg-white">
                      <h2 className="text-sm font-bold tracking-tight mb-3">⭐ Đánh giá từ khách hàng</h2>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="min-w-[200px] rounded-xl border border-black/5 p-3 shrink-0">
                            <div className="flex gap-0.5 mb-1">
                              {[...Array(5)].map((_, j) => (
                                <span key={j} className="text-[10px] text-amber-400">★</span>
                              ))}
                            </div>
                            <p className="text-[10px] text-[#86868b]">"Dịch vụ rất tốt, giao hàng nhanh"</p>
                            <p className="text-[9px] font-medium mt-1">Khách hàng {i}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </SectionOverlay>
                );

              case 'storeInfo':
                return (
                  <SectionOverlay key="storeInfo" sectionId="store-info" label="Thông tin" onEdit={onEditSection}>
                    <section className="py-6 px-4 bg-[#f5f5f7]">
                      <h2 className="text-sm font-bold tracking-tight mb-3">📍 Thông tin liên hệ</h2>
                      <div className="space-y-2 text-[11px] text-[#86868b]">
                        {formData.store_address && <p>📍 {formData.store_address}</p>}
                        {formData.store_phone && <p>📞 {formData.store_phone}</p>}
                        {formData.store_email && <p>✉️ {formData.store_email}</p>}
                        {!formData.store_address && !formData.store_phone && <p>Thêm thông tin liên hệ của bạn</p>}
                      </div>
                    </section>
                  </SectionOverlay>
                );

              case 'categories':
                return (
                  <SectionOverlay key="categories" sectionId="layout" label="Danh mục" onEdit={onEditSection}>
                    <section className="py-4 bg-[#f5f5f7] px-4">
                      {categoryDisplayMode === 'vertical' ? (
                        <div className="grid grid-cols-2 gap-3">
                          {['Danh mục 1', 'Danh mục 2', 'Danh mục 3', 'Danh mục 4'].map((cat, i) => (
                            <div key={i} className="rounded-2xl overflow-hidden relative" style={{ minHeight: '100px' }}>
                              <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/80" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                              <div className="relative z-10 h-full flex flex-col justify-end p-3" style={{ minHeight: '100px' }}>
                                <p className="text-xs font-bold text-white">{cat}</p>
                                <p className="text-[8px] text-white/70">Khám phá →</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                          {['Danh mục 1', 'Danh mục 2', 'Danh mục 3'].map((cat, i) => (
                            <div key={i} className="flex flex-col items-center gap-1.5 min-w-[70px]">
                              <div className="h-14 w-14 rounded-2xl bg-white border border-black/5 flex items-center justify-center">
                                <span className="text-lg opacity-40">📁</span>
                              </div>
                              <span className="text-[10px] font-medium text-center">{cat}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </SectionOverlay>
                );

              case 'branches':
                return (
                  <SectionOverlay key="branches" sectionId="store-info" label="Chi nhánh" onEdit={onEditSection}>
                    <section className="py-6 px-4 bg-white">
                      <h2 className="text-sm font-bold tracking-tight mb-3">📍 Chi nhánh</h2>
                      <div className="space-y-2">
                        {[1, 2].map(i => (
                          <div key={i} className="p-3 rounded-xl border border-black/5">
                            <p className="text-[11px] font-medium">Chi nhánh {i}</p>
                            <p className="text-[10px] text-[#86868b]">Địa chỉ chi nhánh...</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </SectionOverlay>
                );

              case 'flashSale':
                return (
                  <SectionOverlay key="flashSale" sectionId="layout" label="Flash Sale" onEdit={onEditSection}>
                    <section className="py-6 px-4 bg-gradient-to-r from-red-50 to-orange-50">
                      <h2 className="text-sm font-bold tracking-tight mb-3">⚡ Flash Sale</h2>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="min-w-[140px] rounded-xl border border-black/5 overflow-hidden shrink-0 bg-white">
                            <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                              <span className="text-2xl opacity-30">⚡</span>
                            </div>
                            <div className="p-2.5">
                              <p className="text-[11px] font-medium leading-tight">SP Sale {i}</p>
                              <p className="text-[11px] font-bold mt-1 text-red-500">Giảm giá</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </SectionOverlay>
                );

              case 'combo':
                return (
                  <SectionOverlay key="combo" sectionId="layout" label="Combo" onEdit={onEditSection}>
                    <section className="py-6 px-4 bg-white">
                      <h2 className="text-sm font-bold tracking-tight mb-3">🎁 Combo ưu đãi</h2>
                      <div className="grid grid-cols-2 gap-3">
                        {[1, 2].map(i => (
                          <div key={i} className="rounded-xl border border-black/5 p-3">
                            <p className="text-[11px] font-medium">Combo {i}</p>
                            <p className="text-[10px] text-[#86868b]">Tiết kiệm hơn khi mua combo</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </SectionOverlay>
                );

              default:
                return null;
            }
          })}

          {/* FOOTER */}
          <SectionOverlay sectionId="footer" label="Footer" onEdit={onEditSection}>
            <footer className="py-4 border-t text-center">
              <p className="text-[10px] text-[#86868b]">© 2025 {storeName}</p>
            </footer>
          </SectionOverlay>

          {/* STICKY BAR */}
          <SectionOverlay sectionId="sticky-bar" label="Nút liên hệ" onEdit={onEditSection}>
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t px-4 py-2.5">
              <div className="flex items-center gap-2">
                <button className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-white text-xs font-medium" style={{ backgroundColor: accentColor }}>
                  💬 {config.stickyBarLabels.chat}
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium border border-black/10">
                  📞 {config.stickyBarLabels.call}
                </button>
              </div>
            </div>
          </SectionOverlay>
        </div>
      </div>
    </div>
  );
}
