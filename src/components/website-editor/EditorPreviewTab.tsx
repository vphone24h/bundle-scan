import { useState, useMemo } from 'react';
import { TenantLandingSettings } from '@/hooks/useTenantLanding';
import { getIndustryConfig, getFullNavItems, LayoutStyle, HomeSection, SYSTEM_PAGES } from '@/lib/industryConfig';
import { HomeSectionItem, CustomProductTab } from '@/components/admin/HomeSectionManager';
import { ProductsPageSectionItem } from '@/components/admin/ProductsPageSectionManager';
import { ProductDetailSectionItem, CTAButtonItem, getDefaultCTAButtons } from '@/components/admin/ProductDetailSectionManager';
import { NewsPageSectionItem } from '@/components/admin/NewsPageSectionManager';
import { Pencil, Home, ShoppingBag, FileText, ArrowLeft, Newspaper } from 'lucide-react';

type PreviewPage = 'home' | 'products' | 'product-detail' | 'news';

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
  const [previewPage, setPreviewPage] = useState<PreviewPage>('home');
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

  // News page sections
  const npSections = (formData as any)?.custom_news_page_sections as NewsPageSectionItem[] | null;
  const enabledNPSections = useMemo(() => {
    const sections = npSections || [
      { id: 'search', enabled: true },
      { id: 'categoryFilter', enabled: true },
      { id: 'featuredArticles', enabled: true },
      { id: 'allArticles', enabled: true },
    ];
    return sections.filter(s => s.enabled);
  }, [npSections]);

  // Products page sections
  const ppSections = (formData as any)?.custom_products_page_sections as ProductsPageSectionItem[] | null;
  const ppTabs: CustomProductTab[] = (formData as any)?.custom_products_page_tabs || [];
  const enabledPPSections = useMemo(() => {
    const sections = ppSections || [
      { id: 'search', enabled: true },
      { id: 'categoryFilter', enabled: true },
      { id: 'allProducts', enabled: true },
    ];
    return sections.filter(s => s.enabled);
  }, [ppSections]);

  // Product detail sections
  const pdSections = (formData as any)?.custom_product_detail_sections as ProductDetailSectionItem[] | null;
  const enabledPDSections = useMemo(() => {
    const sections = pdSections || [
      { id: 'promotion', enabled: true },
      { id: 'warranty', enabled: true },
      { id: 'description', enabled: true },
      { id: 'relatedProducts', enabled: true },
      { id: 'reviews', enabled: false },
      { id: 'recentlyViewed', enabled: false },
      { id: 'storeInfo', enabled: false },
    ];
    return sections.filter(s => s.enabled);
  }, [pdSections]);

  // Shared header for preview
  const menuPosition = (formData as any)?.menu_position || 'left';
  
  const renderHeader = () => {
    // Top menu position: always-visible horizontal nav below header (no hamburger)
    if (menuPosition === 'top') {
      return (
        <SectionOverlay sectionId="store-info" label="Header" onEdit={onEditSection}>
          <header className="border-b border-black/5 bg-white sticky top-0 z-10">
            <div className="px-4 flex items-center justify-between h-11">
              <div className="flex items-center gap-2.5">
                {formData.store_logo_url ? (
                  <img src={formData.store_logo_url} alt="Logo" className="h-7 w-7 rounded-lg object-cover" />
                ) : null}
                <span className="font-semibold text-xs tracking-tight">{storeName}</span>
              </div>
              <div className="h-4 w-4 text-[#86868b]">🔍</div>
            </div>
            {/* Always-visible horizontal scrollable nav */}
            <div className="px-3 py-1.5 overflow-x-auto scrollbar-hide border-t border-black/5">
              <div className="flex items-center gap-1.5 min-w-max">
                {(navItems as any[]).filter((n: any) => n.enabled !== false).slice(0, 8).map((item: any, i: number) => (
                  <span key={item.id || i} className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap ${i === 0 ? 'text-white' : 'bg-muted/50'}`}
                    style={i === 0 ? { backgroundColor: accentColor } : {}}>
                    {item.icon && <span className="mr-0.5">{item.icon}</span>}
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </header>
        </SectionOverlay>
      );
    }

    // Left or Right menu position
    const isRight = menuPosition === 'right';
    return (
      <SectionOverlay sectionId="store-info" label="Header" onEdit={onEditSection}>
        <header className="border-b border-black/5 bg-white">
          <div className="px-4 flex items-center justify-between h-11">
            {isRight ? (
              <>
                <div className="flex items-center gap-2.5">
                  {formData.store_logo_url ? (
                    <img src={formData.store_logo_url} alt="Logo" className="h-7 w-7 rounded-lg object-cover" />
                  ) : null}
                  <span className="font-semibold text-xs tracking-tight">{storeName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#86868b]">🔍</span>
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-xs">☰</div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-xs">☰</div>
                  {formData.store_logo_url ? (
                    <img src={formData.store_logo_url} alt="Logo" className="h-7 w-7 rounded-lg object-cover" />
                  ) : null}
                  <span className="font-semibold text-xs tracking-tight">{storeName}</span>
                </div>
                <div className="h-4 w-4 text-[#86868b]">🔍</div>
              </>
            )}
          </div>
        </header>
      </SectionOverlay>
    );
  };

  const renderFooter = () => (
    <SectionOverlay sectionId="footer" label="Footer" onEdit={onEditSection}>
      <footer className="py-4 border-t text-center">
        <p className="text-[10px] text-[#86868b]">© 2025 {storeName}</p>
      </footer>
    </SectionOverlay>
  );

  const renderStickyBar = () => (
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
  );

  // Products Page Preview
  const renderProductsPagePreview = () => (
    <>
      {renderHeader()}
      {/* Page title */}
      <div className="px-4 py-3 border-b border-black/5 bg-white">
        <h1 className="text-sm font-bold">Tất cả sản phẩm</h1>
      </div>

      {enabledPPSections.map(section => {
        switch (section.id) {
          case 'search':
            return (
              <SectionOverlay key="search" sectionId="products-layout" label="Tìm kiếm" onEdit={onEditSection}>
                <div className="px-4 py-3 bg-white">
                  <div className="h-9 rounded-lg border border-black/10 bg-[#f5f5f7] px-3 flex items-center">
                    <span className="text-xs text-[#86868b]">🔍 Tìm kiếm sản phẩm...</span>
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'categoryFilter':
            return (
              <SectionOverlay key="categoryFilter" sectionId="products-layout" label="Danh mục" onEdit={onEditSection}>
                <div className="px-4 py-2 bg-white border-b border-black/5">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {['Tất cả', 'iPhone', 'Samsung', 'Phụ kiện'].map((cat, i) => (
                      <span key={i} className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap ${i === 0 ? 'text-white' : 'bg-muted/60 text-foreground/70'}`}
                        style={i === 0 ? { backgroundColor: accentColor } : {}}>
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'allProducts':
            return (
              <SectionOverlay key="allProducts" sectionId="products-layout" label="Sản phẩm" onEdit={onEditSection}>
                <section className="py-4 px-4 bg-white">
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="rounded-xl border border-black/5 overflow-hidden cursor-pointer" onClick={() => setPreviewPage('product-detail')}>
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
                </section>
              </SectionOverlay>
            );
          case 'featuredProducts':
            return (
              <SectionOverlay key="featuredProducts" sectionId="products-layout" label="Nổi bật" onEdit={onEditSection}>
                <section className="py-4 px-4 bg-white">
                  <h2 className="text-sm font-bold tracking-tight mb-3">⭐ Sản phẩm nổi bật</h2>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="min-w-[150px] rounded-xl border border-black/5 overflow-hidden shrink-0">
                        <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <span className="text-2xl opacity-30">⭐</span>
                        </div>
                        <div className="p-2.5">
                          <p className="text-[11px] font-medium leading-tight">SP nổi bật {i}</p>
                          <p className="text-[11px] font-bold mt-1" style={{ color: accentColor }}>Liên hệ</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </SectionOverlay>
            );
          case 'flashSale':
            return (
              <SectionOverlay key="flashSale" sectionId="products-layout" label="Flash Sale" onEdit={onEditSection}>
                <section className="py-4 px-4 bg-gradient-to-r from-red-50 to-orange-50">
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
              <SectionOverlay key="combo" sectionId="products-layout" label="Combo" onEdit={onEditSection}>
                <section className="py-4 px-4 bg-white">
                  <h2 className="text-sm font-bold tracking-tight mb-3">🎁 Combo ưu đãi</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2].map(i => (
                      <div key={i} className="rounded-xl border border-black/5 p-3">
                        <p className="text-[11px] font-medium">Combo {i}</p>
                        <p className="text-[10px] text-[#86868b]">Tiết kiệm khi mua combo</p>
                      </div>
                    ))}
                  </div>
                </section>
              </SectionOverlay>
            );
          case 'reviews':
            return (
              <SectionOverlay key="reviews" sectionId="products-layout" label="Đánh giá" onEdit={onEditSection}>
                <section className="py-4 px-4 bg-white">
                  <h2 className="text-sm font-bold tracking-tight mb-3">💬 Đánh giá khách hàng</h2>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {[1, 2].map(i => (
                      <div key={i} className="min-w-[180px] rounded-xl border border-black/5 p-3 shrink-0">
                        <div className="flex gap-0.5 mb-1">
                          {[...Array(5)].map((_, j) => <span key={j} className="text-[10px] text-amber-400">★</span>)}
                        </div>
                        <p className="text-[10px] text-[#86868b]">"Sản phẩm tốt, giá hợp lý"</p>
                        <p className="text-[9px] font-medium mt-1">Khách hàng {i}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </SectionOverlay>
            );
          default:
            // Custom product tabs (ppTab_*)
            if (section.id.startsWith('ppTab_')) {
              const tab = ppTabs.find(t => t.id === section.id);
              if (!tab) return null;
              return (
                <SectionOverlay key={section.id} sectionId="products-layout" label={tab.name} onEdit={onEditSection}>
                  <section className="py-4 px-4 bg-white">
                    <h2 className="text-sm font-bold tracking-tight mb-3">{tab.icon || '📦'} {tab.name}</h2>
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
                  </section>
                </SectionOverlay>
              );
            }
            // Layout sections from SYSTEM_PAGES
            if (section.id.startsWith('layout_')) {
              const pageId = section.id.replace(/^layout_\d+_/, '').replace(/^layout_/, '');
              const page = SYSTEM_PAGES.find(p => p.id === pageId);
              if (!page) return null;
              return (
                <SectionOverlay key={section.id} sectionId="products-layout" label={page.label} onEdit={onEditSection}>
                  <section className="py-4 px-4 bg-white">
                    <div className="rounded-xl border border-black/5 p-4 text-center space-y-2">
                      <span className="text-3xl">{page.icon}</span>
                      <h3 className="text-sm font-bold">{page.label}</h3>
                      <p className="text-[10px] text-[#86868b]">{page.description}</p>
                    </div>
                  </section>
                </SectionOverlay>
              );
            }
            return null;
        }
      })}

      {renderFooter()}
      {renderStickyBar()}
    </>
  );

  // Product Detail Preview
  const renderProductDetailPreview = () => (
    <>
      {/* Detail header with back button */}
      <header className="border-b border-black/5 bg-white">
        <div className="px-4 flex items-center justify-between h-11">
          <button onClick={() => setPreviewPage('products')} className="flex items-center gap-1 text-xs text-foreground/70">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại</span>
          </button>
          <span className="font-semibold text-xs tracking-tight">{storeName}</span>
          <div className="w-12" />
        </div>
      </header>

      {/* Product image */}
      <SectionOverlay sectionId="product-detail-layout" label="Ảnh SP" onEdit={onEditSection}>
        <div className="aspect-square bg-gradient-to-br from-muted to-muted/30 flex items-center justify-center">
          <span className="text-6xl opacity-20">📱</span>
        </div>
      </SectionOverlay>

      {/* Product info (always shown, not configurable) */}
      <SectionOverlay sectionId="product-detail-layout" label="Thông tin SP" onEdit={onEditSection}>
        <div className="px-4 py-4 bg-white border-b border-black/5">
          <h1 className="text-base font-bold leading-tight">iPhone 15 Pro Max 256GB</h1>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-bold" style={{ color: accentColor }}>29.990.000₫</span>
            <span className="text-xs text-[#86868b] line-through">34.990.000₫</span>
          </div>
          <div className="flex gap-2 mt-3">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-green-50 text-green-700">✓ Còn hàng</span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">🛡️ BH 12 tháng</span>
          </div>
          {/* Color variants */}
          <div className="flex gap-2 mt-3">
            {['#1d1d1f', '#f5f5f7', '#4e5b69', '#f0d9c4'].map((c, i) => (
              <div key={i} className={`h-7 w-7 rounded-full border-2 ${i === 0 ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </SectionOverlay>

      {/* Dynamic sections */}
      {enabledPDSections.map(section => {
        switch (section.id) {
          case 'promotion':
            return (
              <SectionOverlay key="promotion" sectionId="product-detail-layout" label="Khuyến mãi" onEdit={onEditSection}>
                <div className="px-4 py-3 bg-orange-50/50 border-b border-black/5">
                  <h3 className="text-xs font-bold mb-2">🎁 Ưu đãi</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] mt-0.5">✅</span>
                      <p className="text-[11px]">Giảm thêm 500K khi thu cũ đổi mới</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] mt-0.5">✅</span>
                      <p className="text-[11px]">Tặng ốp lưng + cường lực trị giá 300K</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] mt-0.5">✅</span>
                      <p className="text-[11px]">Trả góp 0% qua thẻ tín dụng</p>
                    </div>
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'warranty':
            return (
              <SectionOverlay key="warranty" sectionId="product-detail-layout" label="Bảo hành" onEdit={onEditSection}>
                <div className="px-4 py-3 bg-blue-50/30 border-b border-black/5">
                  <h3 className="text-xs font-bold mb-2">🛡️ Bảo hành</h3>
                  <div className="space-y-1.5">
                    <p className="text-[11px]">• Bảo hành chính hãng 12 tháng</p>
                    <p className="text-[11px]">• 1 đổi 1 trong 30 ngày nếu lỗi phần cứng</p>
                    <p className="text-[11px]">• Hỗ trợ kỹ thuật trọn đời</p>
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'description':
            return (
              <SectionOverlay key="description" sectionId="product-detail-layout" label="Mô tả" onEdit={onEditSection}>
                <div className="px-4 py-4 bg-white border-b border-black/5">
                  <h3 className="text-xs font-bold mb-2">📝 Mô tả sản phẩm</h3>
                  <div className="space-y-2 text-[11px] text-[#3a3a3c] leading-relaxed">
                    <p>iPhone 15 Pro Max với chip A17 Pro mạnh mẽ nhất, thiết kế titan cao cấp.</p>
                    <p>Camera 48MP với zoom quang học 5x cho chất lượng ảnh vượt trội. Màn hình Super Retina XDR 6.7 inch sắc nét.</p>
                    <div className="h-20 rounded-lg bg-muted/50 flex items-center justify-center mt-2">
                      <span className="text-xs text-muted-foreground">Hình ảnh mô tả...</span>
                    </div>
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'relatedProducts':
            return (
              <SectionOverlay key="relatedProducts" sectionId="product-detail-layout" label="SP liên quan" onEdit={onEditSection}>
                <div className="px-4 py-4 bg-[#f5f5f7]">
                  <h3 className="text-xs font-bold mb-3">📦 Sản phẩm liên quan</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="min-w-[130px] rounded-xl border border-black/5 overflow-hidden shrink-0 bg-white">
                        <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <span className="text-xl opacity-30">📦</span>
                        </div>
                        <div className="p-2">
                          <p className="text-[10px] font-medium leading-tight">SP liên quan {i}</p>
                          <p className="text-[10px] font-bold mt-1" style={{ color: accentColor }}>Liên hệ</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'reviews':
            return (
              <SectionOverlay key="reviews-detail" sectionId="product-detail-layout" label="Đánh giá" onEdit={onEditSection}>
                <div className="px-4 py-4 bg-white border-b border-black/5">
                  <h3 className="text-xs font-bold mb-3">💬 Đánh giá sản phẩm</h3>
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="rounded-xl border border-black/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px]">👤</div>
                          <span className="text-[10px] font-medium">Khách hàng {i}</span>
                          <div className="flex gap-0.5 ml-auto">
                            {[...Array(5)].map((_, j) => <span key={j} className="text-[9px] text-amber-400">★</span>)}
                          </div>
                        </div>
                        <p className="text-[10px] text-[#86868b]">"Máy đẹp, giao hàng nhanh, rất hài lòng!"</p>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'recentlyViewed':
            return (
              <SectionOverlay key="recentlyViewed" sectionId="product-detail-layout" label="Đã xem" onEdit={onEditSection}>
                <div className="px-4 py-4 bg-[#f5f5f7]">
                  <h3 className="text-xs font-bold mb-3">👁️ Đã xem gần đây</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="min-w-[110px] rounded-xl border border-black/5 overflow-hidden shrink-0 bg-white">
                        <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <span className="text-lg opacity-30">👁️</span>
                        </div>
                        <div className="p-2">
                          <p className="text-[10px] font-medium leading-tight">SP {i}</p>
                          <p className="text-[10px] font-bold mt-0.5" style={{ color: accentColor }}>Liên hệ</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'storeInfo':
            return (
              <SectionOverlay key="storeInfo-detail" sectionId="product-detail-layout" label="Cửa hàng" onEdit={onEditSection}>
                <div className="px-4 py-4 bg-white border-b border-black/5">
                  <h3 className="text-xs font-bold mb-2">📞 Thông tin cửa hàng</h3>
                  <div className="space-y-1.5 text-[11px] text-[#86868b]">
                    {formData.store_address && <p>📍 {formData.store_address}</p>}
                    {formData.store_phone && <p>📞 {formData.store_phone}</p>}
                    {!formData.store_address && !formData.store_phone && <p>📍 Địa chỉ cửa hàng • 📞 Hotline</p>}
                  </div>
                </div>
              </SectionOverlay>
            );
          default:
            // Layout sections from SYSTEM_PAGES
            if (section.id.startsWith('layout_')) {
              const pageId = section.id.replace(/^layout_\d+_/, '').replace(/^layout_/, '');
              const page = SYSTEM_PAGES.find(p => p.id === pageId);
              if (!page) return null;
              return (
                <SectionOverlay key={section.id} sectionId="product-detail-layout" label={page.label} onEdit={onEditSection}>
                  <div className="px-4 py-3 bg-white border-b border-black/5">
                    <div className="rounded-xl border border-black/5 p-4 text-center space-y-2">
                      <span className="text-2xl">{page.icon}</span>
                      <h3 className="text-xs font-bold">{page.label}</h3>
                      <p className="text-[10px] text-[#86868b]">{page.description}</p>
                    </div>
                  </div>
                </SectionOverlay>
              );
            }
            return null;
        }
      })}

      {/* Bottom CTA bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-white text-xs font-medium" style={{ backgroundColor: accentColor }}>
            🛒 Đặt mua ngay
          </button>
          <button className="px-4 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-medium border border-black/10">
            💬 Hỏi
          </button>
        </div>
      </div>
    </>
  );

  // Get news page label from nav items
  const newsNavLabel = useMemo(() => {
    const items = (formData as any)?.custom_nav_items || getFullNavItems(templateId);
    const newsItem = items.find((item: any) => {
      const label = (item.label || item || '').toLowerCase();
      return label.includes('tin') || label.includes('bài viết') || label.includes('blog') || label.includes('news') || label.includes('thông tin');
    });
    return newsItem?.label || newsItem || 'Tin tức';
  }, [formData, templateId]);

  // News Page Preview
  const renderNewsPagePreview = () => (
    <>
      {renderHeader()}
      <div className="px-4 py-3 border-b border-black/5 bg-white">
        <h1 className="text-sm font-bold">{newsNavLabel}</h1>
      </div>

      {enabledNPSections.map(section => {
        switch (section.id) {
          case 'search':
            return (
              <SectionOverlay key="search" sectionId="news-layout" label="Tìm kiếm" onEdit={onEditSection}>
                <div className="px-4 py-3 bg-white">
                  <div className="h-9 rounded-lg border border-black/10 bg-[#f5f5f7] px-3 flex items-center">
                    <span className="text-xs text-[#86868b]">🔍 Tìm kiếm bài viết...</span>
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'categoryFilter':
            return (
              <SectionOverlay key="categoryFilter" sectionId="news-layout" label="Danh mục" onEdit={onEditSection}>
                <div className="px-4 py-2 bg-white border-b border-black/5">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {['Tất cả', 'Tin Apple', 'Đánh giá', 'Mẹo hay'].map((cat, i) => (
                      <span key={i} className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap ${i === 0 ? 'text-white' : 'bg-muted/60 text-foreground/70'}`}
                        style={i === 0 ? { backgroundColor: accentColor } : {}}>
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </SectionOverlay>
            );
          case 'featuredArticles':
            return (
              <SectionOverlay key="featuredArticles" sectionId="news-layout" label="Nổi bật" onEdit={onEditSection}>
                <section className="py-4 px-4 bg-white">
                  <h2 className="text-sm font-bold tracking-tight mb-3">⭐ Bài viết nổi bật</h2>
                  <div className="rounded-xl border border-black/5 overflow-hidden">
                    <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <span className="text-3xl opacity-20">📰</span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold leading-tight">Bài viết nổi bật mẫu</p>
                      <p className="text-[10px] text-[#86868b] mt-1">Mô tả ngắn bài viết nổi bật...</p>
                    </div>
                  </div>
                </section>
              </SectionOverlay>
            );
          case 'allArticles':
            return (
              <SectionOverlay key="allArticles" sectionId="news-layout" label="Tất cả" onEdit={onEditSection}>
                <section className="py-4 px-4 bg-white">
                  <h2 className="text-sm font-bold tracking-tight mb-3">📰 Tất cả bài viết</h2>
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex gap-3 rounded-xl border border-black/5 p-2.5">
                        <div className="h-16 w-20 rounded-lg bg-gradient-to-br from-muted to-muted/50 shrink-0 flex items-center justify-center">
                          <span className="text-lg opacity-20">📝</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium leading-tight line-clamp-2">Bài viết mẫu {i}</p>
                          <p className="text-[9px] text-[#86868b] mt-1">2 ngày trước</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </SectionOverlay>
            );
          case 'latestArticles':
            return (
              <SectionOverlay key="latestArticles" sectionId="news-layout" label="Mới nhất" onEdit={onEditSection}>
                <section className="py-4 px-4 bg-white">
                  <h2 className="text-sm font-bold tracking-tight mb-3">🆕 Bài viết mới nhất</h2>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="min-w-[160px] rounded-xl border border-black/5 overflow-hidden shrink-0">
                        <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <span className="text-xl opacity-20">🆕</span>
                        </div>
                        <div className="p-2.5">
                          <p className="text-[11px] font-medium leading-tight">Bài mới {i}</p>
                          <p className="text-[9px] text-[#86868b] mt-1">Hôm nay</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </SectionOverlay>
            );
          case 'popularArticles':
            return (
              <SectionOverlay key="popularArticles" sectionId="news-layout" label="Phổ biến" onEdit={onEditSection}>
                <section className="py-4 px-4 bg-white">
                  <h2 className="text-sm font-bold tracking-tight mb-3">🔥 Bài viết phổ biến</h2>
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-3 rounded-xl border border-black/5 p-2.5">
                        <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: accentColor, color: 'white' }}>
                          {i}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium leading-tight">Bài viết phổ biến {i}</p>
                          <p className="text-[9px] text-[#86868b] mt-1">👁 {1000 - i * 200} lượt xem</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </SectionOverlay>
            );
          default:
            // Custom news tabs (newsTab_*)
            if (section.id.startsWith('newsTab_')) {
              return (
                <SectionOverlay key={section.id} sectionId="news-layout" label="Mục tùy chỉnh" onEdit={onEditSection}>
                  <section className="py-4 px-4 bg-white">
                    <h2 className="text-sm font-bold tracking-tight mb-3">📝 Danh mục tùy chỉnh</h2>
                    <div className="space-y-3">
                      {[1, 2].map(i => (
                        <div key={i} className="flex gap-3 rounded-xl border border-black/5 p-2.5">
                          <div className="h-16 w-20 rounded-lg bg-gradient-to-br from-muted to-muted/50 shrink-0 flex items-center justify-center">
                            <span className="text-lg opacity-20">📝</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium leading-tight">Bài viết {i}</p>
                            <p className="text-[9px] text-[#86868b] mt-1">3 ngày trước</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </SectionOverlay>
              );
            }
            // Layout sections from SYSTEM_PAGES
            if (section.id.startsWith('layout_')) {
              const pageId = section.id.replace(/^layout_\d+_/, '').replace(/^layout_/, '');
              const page = SYSTEM_PAGES.find(p => p.id === pageId);
              if (!page) return null;
              return (
                <SectionOverlay key={section.id} sectionId="news-layout" label={page.label} onEdit={onEditSection}>
                  <section className="py-4 px-4 bg-white">
                    <div className="rounded-xl border border-black/5 p-4 text-center space-y-2">
                      <span className="text-3xl">{page.icon}</span>
                      <h3 className="text-sm font-bold">{page.label}</h3>
                      <p className="text-[10px] text-[#86868b]">{page.description}</p>
                    </div>
                  </section>
                </SectionOverlay>
              );
            }
            return null;
        }
      })}

      {renderFooter()}
      {renderStickyBar()}
    </>
  );

  return (
    <div className="min-h-full bg-muted/30 flex flex-col" onClick={() => {}}>
      {/* Page switcher tabs */}
      <div className="sticky top-0 z-30 bg-background border-b px-2 py-1.5 flex items-center gap-1">
        {([
          { id: 'home' as PreviewPage, icon: <Home className="h-3.5 w-3.5" />, label: 'Trang chủ' },
          { id: 'products' as PreviewPage, icon: <ShoppingBag className="h-3.5 w-3.5" />, label: 'Sản phẩm' },
          { id: 'product-detail' as PreviewPage, icon: <FileText className="h-3.5 w-3.5" />, label: 'Chi tiết SP' },
          { id: 'news' as PreviewPage, icon: <Newspaper className="h-3.5 w-3.5" />, label: newsNavLabel as string },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setPreviewPage(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
              previewPage === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex justify-center pb-4">
        <div
          className="bg-white shadow-xl mx-auto my-0 sm:my-4 sm:rounded-xl overflow-hidden"
          style={{ ...getFrameStyle(), width: '100%' }}
        >
          <div className="text-[#1d1d1f]" style={{ fontFamily: config.fontFamily }}>
            {previewPage === 'products' && renderProductsPagePreview()}
            {previewPage === 'product-detail' && renderProductDetailPreview()}
            {previewPage === 'news' && renderNewsPagePreview()}
            {previewPage === 'home' && (
              <>
                {/* HEADER */}
                {renderHeader()}

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
                      // Layout sections from SYSTEM_PAGES
                      if (sectionId.startsWith('layout_')) {
                        const pageId = sectionId.replace(/^layout_\d+_/, '').replace(/^layout_/, '');
                        const page = SYSTEM_PAGES.find(p => p.id === pageId);
                        if (!page) return null;
                        return (
                          <SectionOverlay key={sectionId} sectionId="layout" label={page.label} onEdit={onEditSection}>
                            <section className="py-6 px-4 bg-white">
                              <div className="rounded-xl border border-black/5 p-5 text-center space-y-2">
                                <span className="text-3xl">{page.icon}</span>
                                <h3 className="text-sm font-bold">{page.label}</h3>
                                <p className="text-[10px] text-[#86868b]">{page.description}</p>
                              </div>
                            </section>
                          </SectionOverlay>
                        );
                      }
                      return null;
                  }
                })}

                {/* FOOTER */}
                {renderFooter()}

                {/* STICKY BAR */}
                {renderStickyBar()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
