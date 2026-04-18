/**
 * Price List Template (taoquangsang.vn style)
 * 1 trang chủ duy nhất:
 *   Header (sticky menu danh mục từ Tin tức) + Banner + Địa chỉ/SĐT + List bảng giá (mỗi bài viết = 1 bảng)
 * Nội dung bảng giá biên tập trong mục Tin tức (Landing → Bài viết).
 */
import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { SetURLSearchParams } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { TenantLandingSettings, BranchInfo } from '@/hooks/useTenantLanding';
import { LandingProduct, LandingProductCategory } from '@/hooks/useLandingProducts';
import { LandingArticle, LandingArticleCategory } from '@/hooks/useLandingArticles';
import { getIndustryConfig } from '@/lib/industryConfig';
import { Phone, MapPin, MessageCircle, Clock, RefreshCcw } from 'lucide-react';

export interface PriceListTemplateProps {
  settings: TenantLandingSettings | null;
  tenant: { id: string; name: string; subdomain: string; status: string };
  tenantId: string | null;
  storeId: string | null;
  branches: BranchInfo[];
  productsData: { categories: LandingProductCategory[]; products: LandingProduct[] } | undefined;
  articlesData: { categories: LandingArticleCategory[]; articles: LandingArticle[] } | undefined;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  queryClient: QueryClient;
  onRequireCatalogData?: () => void;
}

function slugifyId(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function PriceListTemplate({
  settings, tenant, branches, articlesData, onRequireCatalogData,
}: PriceListTemplateProps) {
  const config = getIndustryConfig('price_list');
  const accentColor = settings?.primary_color || config.accentColor;
  const storeName = settings?.store_name || tenant?.name || 'Cửa hàng';
  const logoUrl = settings?.store_logo_url || null;
  const phone = settings?.store_phone || null;
  const address = settings?.store_address || branches?.[0]?.address || null;
  const additionalAddresses = settings?.additional_addresses || null;
  const zaloUrl = settings?.zalo_url || null;
  const bannerUrl = settings?.banner_image_url || null;
  const workingHours = (settings as any)?.working_hours || 'Từ 08:00 sáng đến 21:00 tối';

  // Trigger catalog data load (articles)
  useEffect(() => {
    onRequireCatalogData?.();
  }, [onRequireCatalogData]);

  // Today date in VN format
  const todayLabel = useMemo(() => {
    const d = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${days[d.getDay()]} - ${dd}/${mm}/${d.getFullYear()}`;
  }, []);

  // Articles → mỗi bài là 1 bảng giá
  const articles = useMemo(() => {
    const list = articlesData?.articles || [];
    return [...list]
      .filter(a => (a as any).is_published !== false)
      .sort((a, b) => ((a as any).display_order ?? 0) - ((b as any).display_order ?? 0));
  }, [articlesData]);

  // Build sticky menu from articles
  const menuItems = useMemo(
    () => articles.map(a => ({ id: slugifyId(a.title || a.id), label: a.title || 'Bảng giá' })),
    [articles]
  );

  const allAddresses = useMemo(() => {
    const arr: string[] = [];
    if (address) arr.push(address);
    (additionalAddresses || []).forEach(x => x && arr.push(x));
    branches?.forEach(b => {
      if (b.address && !arr.includes(b.address)) arr.push(b.address);
    });
    return arr;
  }, [address, additionalAddresses, branches]);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: config.fontFamily }}>
      {/* === HEADER + STICKY MENU === */}
      <header className="sticky top-0 z-50 bg-black text-white shadow-lg">
        {/* Top bar with logo + contact summary */}
        <div className="bg-black border-b border-white/10">
          <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-9 w-9 sm:h-11 sm:w-11 object-contain rounded shrink-0 bg-white/5" />
            ) : (
              <div className="h-9 w-9 sm:h-11 sm:w-11 rounded bg-white/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold">{storeName.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-[11px] sm:text-xs">
              {allAddresses.slice(0, 2).map((addr, i) => (
                <a
                  key={i}
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="border border-white/15 rounded px-2 py-1 hover:bg-white/5 truncate"
                  title={addr}
                >
                  📍 <span className="truncate">{addr}</span>
                  {phone && <span className="block opacity-80">{phone}</span>}
                </a>
              ))}
              {allAddresses.length === 0 && phone && (
                <a href={`tel:${phone}`} className="border border-white/15 rounded px-2 py-1 hover:bg-white/5">
                  📞 {phone}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Sticky category menu (jump to article tables) */}
        {menuItems.length > 0 && (
          <nav className="bg-black border-b border-white/10 overflow-x-auto scrollbar-hide">
            <div className="max-w-6xl mx-auto px-2 flex items-center gap-1 sm:gap-2 whitespace-nowrap">
              {menuItems.map(m => (
                <a
                  key={m.id}
                  href={`#${m.id}`}
                  className="text-[11px] sm:text-xs font-semibold px-2.5 py-2.5 hover:bg-white/10 transition-colors uppercase tracking-tight"
                >
                  {m.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* === BANNER === */}
      {bannerUrl && (
        <div className="w-full">
          <img src={bannerUrl} alt={storeName} className="w-full h-auto object-cover block" loading="eager" />
        </div>
      )}

      {/* === ĐỊA CHỈ / SĐT TO === */}
      {(address || phone || zaloUrl) && (
        <section className="px-4 py-6 sm:py-8 text-center bg-white">
          {address && (
            <p className="text-base sm:text-2xl font-bold text-blue-700 leading-snug mb-2">
              <MapPin className="inline-block h-4 w-4 sm:h-5 sm:w-5 -mt-1 mr-1" />
              Địa chỉ: <span className="text-blue-900">{address}</span>
              {phone && <> – SĐT: <a href={`tel:${phone}`} className="underline">{phone}</a></>}
            </p>
          )}
          {zaloUrl && (
            <p className="text-base sm:text-2xl font-bold text-blue-700 leading-snug">
              <MessageCircle className="inline-block h-4 w-4 sm:h-5 sm:w-5 -mt-1 mr-1" />
              Mua hàng Zalo: <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="text-blue-900 underline">{phone || 'Bấm để chat'}</a>
            </p>
          )}

          <hr className="my-4 border-dashed border-gray-300 max-w-xs mx-auto" />

          <p className="text-sm sm:text-base text-gray-800 mb-2">
            📌 <span className="font-bold">THỜI GIAN LÀM VIỆC</span> <Clock className="inline-block h-4 w-4 -mt-1 mx-1 text-orange-500" />
            {workingHours}
          </p>
          <p className="text-base sm:text-xl font-bold text-green-700 leading-snug">
            CẬP NHẬT LIÊN TỤC 24/24<br />
            <RefreshCcw className="inline-block h-4 w-4 mr-1" />
            ACE NHỚ NHẤN F5 LẠI NHÉ
          </p>
          <p className="mt-3 text-sm sm:text-lg font-semibold text-gray-900">{todayLabel}</p>
        </section>
      )}

      {/* === DANH SÁCH BẢNG GIÁ (từ Tin tức) === */}
      <main className="max-w-6xl mx-auto px-2 sm:px-4 pb-12">
        {articles.length === 0 ? (
          <div className="text-center py-16 px-4 border-2 border-dashed border-gray-300 rounded-lg my-6 text-gray-500">
            <p className="text-base font-medium mb-1">{config.emptyProductText}</p>
            <p className="text-xs">
              Mỗi bài viết = 1 bảng giá. Có thể dán bảng HTML trực tiếp từ Excel/Word.
            </p>
          </div>
        ) : (
          articles.map(article => {
            const id = slugifyId(article.title || article.id);
            const html = (article as any).content || (article as any).body || '';
            return (
              <section key={article.id} id={id} className="scroll-mt-28 mb-6">
                {article.title && (
                  <h2
                    className="text-center text-base sm:text-2xl font-bold text-white py-2.5 px-4 rounded-t"
                    style={{ background: accentColor }}
                  >
                    ★ {article.title}
                  </h2>
                )}
                <div
                  className="price-list-content border border-t-0 border-gray-200 bg-white px-2 py-3 sm:px-4 sm:py-4 overflow-x-auto"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(html, {
                      ADD_ATTR: ['target', 'style', 'colspan', 'rowspan', 'align', 'valign', 'bgcolor', 'width', 'height'],
                      ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
                    }),
                  }}
                />
              </section>
            );
          })
        )}
      </main>

      {/* === FOOTER === */}
      <footer className="bg-gray-900 text-gray-300 py-6 text-center text-xs">
        <p className="mb-1 font-semibold text-white">{storeName}</p>
        {phone && <p>📞 {phone}</p>}
        {address && <p>📍 {address}</p>}
        <p className="mt-3 opacity-60">© {new Date().getFullYear()} {storeName}. Mọi quyền được bảo lưu.</p>
      </footer>

      {/* Floating call button */}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center text-white"
          style={{ background: accentColor }}
          aria-label="Gọi ngay"
        >
          <Phone className="h-6 w-6" />
        </a>
      )}

      {/* Style cho bảng từ Tin tức (HTML thô từ editor) */}
      <style>{`
        .price-list-content table { width: 100%; border-collapse: collapse; }
        .price-list-content table, .price-list-content th, .price-list-content td {
          border: 1px solid #d1d5db;
        }
        .price-list-content th, .price-list-content td {
          padding: 6px 8px; font-size: 12px; vertical-align: middle;
        }
        @media (min-width: 640px) {
          .price-list-content th, .price-list-content td { font-size: 13px; padding: 8px 10px; }
        }
        .price-list-content th { background: #f3f4f6; font-weight: 700; text-align: center; }
        .price-list-content tr:nth-child(even) td { background: #fafafa; }
        .price-list-content img { max-width: 100%; height: auto; }
        .price-list-content p { margin: 4px 0; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
