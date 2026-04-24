import { LandingProduct } from '@/hooks/useLandingProducts';
import { LayoutStyle } from '@/lib/industryConfig';
import { formatNumber } from '@/lib/formatNumber';
import { Package, Star, Zap, ShoppingBag } from 'lucide-react';
import { PRODUCT_BADGE_OPTIONS } from '@/components/admin/LandingProductsTab';

// Shared sold-out overlay
function SoldOutOverlay() {
  return (
    <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center">
      <span className="bg-white/90 text-red-600 font-bold text-xs sm:text-sm px-3 py-1.5 rounded-full shadow-md tracking-wide">
        ĐÃ HẾT
      </span>
    </div>
  );
}

// Shared badge overlay for product cards
export function ProductBadges({ badges }: { badges?: string[] }) {
  if (!badges || badges.length === 0) return null;
  const items = badges.slice(0, 2).map(b => PRODUCT_BADGE_OPTIONS.find(o => o.id === b)).filter(Boolean);
  if (items.length === 0) return null;

  const getBadgeGradient = (opt: typeof PRODUCT_BADGE_OPTIONS[0]) => {
    const gradients: Record<string, string> = {
      'bg-red-500': '#dc2626',
      'bg-orange-500': '#ea580c',
      'bg-pink-500': '#db2777',
      'bg-blue-500': '#2563eb',
      'bg-emerald-500': '#059669',
      'bg-yellow-500': '#ca8a04',
      'bg-violet-500': '#7c3aed',
      'bg-teal-500': '#0d9488',
      'bg-amber-600': '#d97706',
      'bg-rose-600': '#e11d48',
      'bg-indigo-500': '#4f46e5',
      'bg-cyan-500': '#0891b2',
      'bg-purple-600': '#9333ea',
      'bg-fuchsia-500': '#c026d3',
    };
    return gradients[opt.color] || '#dc2626';
  };

  // Split label into [prefix, highlight] to emphasize one keyword like "Giảm 4%"
  const splitLabel = (id: string, text: string): [string, string] => {
    const map: Record<string, [string, string]> = {
      new: ['Hàng', 'NEW'],
      hot: ['Đang', 'HOT'],
      trending: ['', 'TRENDING'],
      popular: ['Được', 'QUAN TÂM'],
      best_choice: ['', 'ĐỀ XUẤT'],
      sale: ['', 'SALE'],
      deal: ['Deal', 'HÔM NAY'],
      clearance: ['', 'XẢ KHO'],
      genuine: ['', 'CHÍNH HÃNG'],
      warranty: ['Bảo hành', 'TỐT'],
      quality: ['Chất lượng', 'CAO'],
      preorder: ['', 'PRE-ORDER'],
      limited: ['', 'LIMITED'],
      exclusive: ['', 'ĐỘC QUYỀN'],
    };
    return map[id] || ['', text.toUpperCase()];
  };

  // Each badge has its own corner + visual style so multiple badges never overlap
  type Corner = 'tl' | 'tr' | 'bl' | 'br';
  type Variant = 'pill' | 'flame';
  const BADGE_LAYOUT: Record<string, { corner: Corner; variant: Variant }> = {
    new:        { corner: 'tl', variant: 'pill' },
    hot:        { corner: 'tr', variant: 'flame' },
    sale:       { corner: 'bl', variant: 'flame' },
    deal:       { corner: 'bl', variant: 'flame' },
    clearance:  { corner: 'bl', variant: 'flame' },
    trending:   { corner: 'tr', variant: 'pill' },
    popular:    { corner: 'br', variant: 'pill' },
    best_choice:{ corner: 'br', variant: 'pill' },
    genuine:    { corner: 'tl', variant: 'pill' },
    warranty:   { corner: 'br', variant: 'pill' },
    quality:    { corner: 'br', variant: 'pill' },
    preorder:   { corner: 'tr', variant: 'pill' },
    limited:    { corner: 'bl', variant: 'flame' },
    exclusive:  { corner: 'tl', variant: 'pill' },
  };

  const cornerClass = (c: Corner) => {
    switch (c) {
      case 'tl': return 'top-2 left-2';
      case 'tr': return 'top-2 right-2';
      case 'bl': return 'bottom-2 left-2';
      case 'br': return 'bottom-2 right-2';
    }
  };

  const PillBadge = ({ opt, corner }: { opt: typeof PRODUCT_BADGE_OPTIONS[0]; corner: Corner }) => {
    const [prefix, highlight] = splitLabel(opt.id, opt.text);
    return (
      <div
        className={`absolute z-10 animate-badge-pulse flex items-center gap-1 ${cornerClass(corner)}`}
        style={{
          background: getBadgeGradient(opt),
          color: '#fff',
          padding: '4px 10px',
          borderRadius: '999px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          lineHeight: 1.1,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {prefix && (
          <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.95 }}>{prefix}</span>
        )}
        <span style={{ fontSize: 11, fontWeight: 900 }}>{highlight}</span>
      </div>
    );
  };

  // "Flame" badge — slanted pill with a flame tail, like the "Giá Rẻ" reference
  const FlameBadge = ({ opt, corner }: { opt: typeof PRODUCT_BADGE_OPTIONS[0]; corner: Corner }) => {
    const [, highlight] = splitLabel(opt.id, opt.text);
    const baseColor = getBadgeGradient(opt);
    const isRight = corner === 'tr' || corner === 'br';
    return (
      <div
        className={`absolute z-10 animate-badge-pulse ${cornerClass(corner)}`}
        style={{ transform: isRight ? 'rotate(8deg)' : 'rotate(-8deg)' }}
      >
        <div
          style={{
            position: 'relative',
            background: `linear-gradient(135deg, #fbbf24 0%, ${baseColor} 55%, #b91c1c 100%)`,
            color: '#fff',
            padding: '4px 12px',
            borderRadius: '999px',
            boxShadow: '0 3px 8px rgba(220,38,38,0.35)',
            fontSize: 12,
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '0.04em',
            textShadow: '0 1px 2px rgba(0,0,0,0.25)',
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
          }}
        >
          {highlight}
          {/* Flame tail */}
          <span
            style={{
              position: 'absolute',
              top: '50%',
              [isRight ? 'left' : 'right']: -6,
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              [isRight ? 'borderRight' : 'borderLeft']: `10px solid #fbbf24`,
              filter: 'drop-shadow(0 1px 2px rgba(220,38,38,0.4))',
            } as any}
          />
        </div>
      </div>
    );
  };

  const renderBadge = (opt: typeof PRODUCT_BADGE_OPTIONS[0], idx: number) => {
    const layout = BADGE_LAYOUT[opt.id] || { corner: (idx === 0 ? 'tl' : 'tr') as Corner, variant: 'pill' as Variant };
    // If both badges land in the same corner, push the second to the opposite vertical
    let corner = layout.corner;
    if (idx === 1 && items[0]) {
      const first = BADGE_LAYOUT[items[0]!.id]?.corner;
      if (first === corner) {
        const flip: Record<Corner, Corner> = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' };
        corner = flip[corner];
      }
    }
    return layout.variant === 'flame'
      ? <FlameBadge key={opt.id} opt={opt} corner={corner} />
      : <PillBadge key={opt.id} opt={opt} corner={corner} />;
  };

  return <>{items.map((opt, i) => renderBadge(opt!, i))}</>;
}

interface ProductCardProps {
  product: LandingProduct;
  onClick: () => void;
  accentColor: string;
}

// === APPLE PRODUCT CARD === (Clean, minimal, premium)
function AppleProductCard({ product, onClick, accentColor }: ProductCardProps) {
  return (
    <button onClick={onClick} className={`bg-[#f5f5f7] rounded-2xl overflow-hidden text-left group transition-all hover:shadow-lg w-full ${product.is_sold_out ? 'opacity-80' : ''}`}>
      <div className="relative overflow-hidden">
        {product.is_sold_out && <SoldOutOverlay />}
        <ProductBadges badges={(product as any).badges} />
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full aspect-square bg-[#e8e8ed] flex items-center justify-center"><Package className="h-10 w-10 text-[#86868b]" /></div>
        )}
        {product.sale_price && !(Array.isArray((product as any).badges) && (product as any).badges.length > 0) && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            -{Math.round(((product.price - product.sale_price) / product.price) * 100)}%
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
          <span className="text-white text-xs font-medium bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5">Xem chi tiết</span>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <p className="font-medium text-xs sm:text-sm line-clamp-2 min-h-[2rem] leading-tight">{product.name}</p>
        <div className="mt-2">
          {product.sale_price ? (
            <div className="space-y-0.5">
              <p className="text-xs text-[#86868b] line-through">{formatNumber(product.price)}đ</p>
              <p className="font-bold text-sm text-red-600">{formatNumber(product.sale_price)}đ</p>
            </div>
          ) : (
            <p className="font-bold text-sm text-[#1d1d1f]">{formatNumber(product.price)}đ</p>
          )}
        </div>
      </div>
    </button>
  );
}

// === TGDD PRODUCT CARD === (Badge-heavy, promo labels, star ratings)
function TGDDProductCard({ product, onClick, accentColor }: ProductCardProps) {
  const discount = product.sale_price ? Math.round(((product.price - product.sale_price) / product.price) * 100) : 0;
  return (
    <button onClick={onClick} className={`bg-white rounded-xl border border-gray-200 overflow-hidden text-left group transition-all hover:shadow-xl hover:border-blue-300 w-full relative ${product.is_sold_out ? 'opacity-80' : ''}`}>
      {product.is_sold_out && <SoldOutOverlay />}
        <ProductBadges badges={(product as any).badges} />
      {discount > 0 && (
        <div className="absolute top-0 right-0 z-10 bg-red-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-bl-xl">
          -{discount}%
        </div>
      )}
      <div className="relative overflow-hidden p-3 bg-gray-50">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-square object-contain group-hover:scale-110 transition-transform duration-300" />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center"><Package className="h-10 w-10 text-gray-300" /></div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="font-medium text-xs line-clamp-2 min-h-[2.5rem] leading-snug text-gray-800">{product.name}</p>
        {/* Star rating mock */}
        <div className="flex items-center gap-0.5">
          {[1,2,3,4,5].map(i => <Star key={i} className="h-3 w-3 text-yellow-400 fill-yellow-400" />)}
          <span className="text-[10px] text-gray-400 ml-1">(99+)</span>
        </div>
        <div>
          {product.sale_price ? (
            <>
              <p className="font-extrabold text-sm text-red-600">{formatNumber(product.sale_price)}đ</p>
              <p className="text-[11px] text-gray-400 line-through">{formatNumber(product.price)}đ</p>
            </>
          ) : (
            <p className="font-extrabold text-sm text-blue-700">{formatNumber(product.price)}đ</p>
          )}
        </div>
        {/* Promo labels */}
        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] bg-blue-50 text-blue-600 font-semibold px-1.5 py-0.5 rounded border border-blue-100">Trả góp 0%</span>
          <span className="text-[9px] bg-green-50 text-green-600 font-semibold px-1.5 py-0.5 rounded border border-green-100">Freeship</span>
        </div>
      </div>
    </button>
  );
}

// === HASAKI PRODUCT CARD === (Beauty style, deal tags, review stars)
function HasakiProductCard({ product, onClick, accentColor }: ProductCardProps) {
  const discount = product.sale_price ? Math.round(((product.price - product.sale_price) / product.price) * 100) : 0;
  return (
    <button onClick={onClick} className={`bg-white rounded-2xl overflow-hidden text-left group transition-all hover:shadow-lg w-full border border-pink-100/50 ${product.is_sold_out ? 'opacity-80' : ''}`}>
      <div className="relative overflow-hidden">
        {product.is_sold_out && <SoldOutOverlay />}
        <ProductBadges badges={(product as any).badges} />
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full aspect-square bg-pink-50 flex items-center justify-center"><Package className="h-10 w-10 text-pink-300" /></div>
        )}
        {discount > 0 && (
          <div className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
            <Zap className="h-3 w-3" /> -{discount}%
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="font-medium text-xs line-clamp-2 min-h-[2rem] leading-tight text-gray-800">{product.name}</p>
        <div className="flex items-center gap-0.5">
          {[1,2,3,4,5].map(i => <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />)}
          <span className="text-[10px] text-gray-400 ml-1">({Math.floor(Math.random() * 200) + 50})</span>
        </div>
        <div>
          {product.sale_price ? (
            <div className="flex items-baseline gap-2">
              <p className="font-bold text-sm text-red-600">{formatNumber(product.sale_price)}đ</p>
              <p className="text-[10px] text-gray-400 line-through">{formatNumber(product.price)}đ</p>
            </div>
          ) : (
            <p className="font-bold text-sm text-gray-900">{formatNumber(product.price)}đ</p>
          )}
        </div>
        {/* Deal tag */}
        {product.sale_price && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg px-2 py-1 border border-red-100">
            <p className="text-[9px] font-bold text-red-600">🔥 Deal sốc hôm nay</p>
          </div>
        )}
      </div>
    </button>
  );
}

// === NIKE PRODUCT CARD === (Bold, minimal, lifestyle)
function NikeProductCard({ product, onClick, accentColor }: ProductCardProps) {
  return (
    <button onClick={onClick} className={`text-left group w-full ${product.is_sold_out ? 'opacity-80' : ''}`}>
      <div className="relative overflow-hidden rounded-xl bg-[#f5f5f5]">
        {product.is_sold_out && <SoldOutOverlay />}
        <ProductBadges badges={(product as any).badges} />
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-[3/4] object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full aspect-[3/4] flex items-center justify-center"><Package className="h-12 w-12 text-gray-300" /></div>
        )}
        {product.sale_price && (
          <div className="absolute top-3 left-3 bg-black text-white text-[11px] font-bold px-3 py-1 rounded-sm">
            SALE
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
      </div>
      <div className="pt-3 space-y-1">
        <p className="font-semibold text-sm line-clamp-1">{product.name}</p>
        <div className="flex items-baseline gap-2">
          {product.sale_price ? (
            <>
              <p className="font-bold text-sm">{formatNumber(product.sale_price)}đ</p>
              <p className="text-xs text-gray-400 line-through">{formatNumber(product.price)}đ</p>
            </>
          ) : (
            <p className="font-bold text-sm">{formatNumber(product.price)}đ</p>
          )}
        </div>
      </div>
    </button>
  );
}

// === LUXURY PRODUCT CARD ===
function LuxuryProductCard({ product, onClick, accentColor }: ProductCardProps) {
  return (
    <button onClick={onClick} className={`text-left group w-full ${product.is_sold_out ? 'opacity-80' : ''}`}>
      <div className="relative overflow-hidden bg-[#faf8f5] border border-amber-100/50">
        {product.is_sold_out && <SoldOutOverlay />}
        <ProductBadges badges={(product as any).badges} />
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center"><Package className="h-10 w-10 text-amber-200" /></div>
        )}
        {product.sale_price && (
          <div className="absolute top-3 left-3 bg-amber-800 text-amber-100 text-[10px] font-medium tracking-wider px-3 py-1">
            ƯU ĐÃI
          </div>
        )}
      </div>
      <div className="pt-3 space-y-1 text-center">
        <p className="font-light text-sm tracking-wide line-clamp-2" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{product.name}</p>
        <div>
          {product.sale_price ? (
            <div className="space-y-0.5">
              <p className="text-xs text-gray-400 line-through">{formatNumber(product.price)}đ</p>
              <p className="font-semibold text-sm text-amber-800">{formatNumber(product.sale_price)}đ</p>
            </div>
          ) : (
            <p className="font-semibold text-sm text-gray-900">{formatNumber(product.price)}đ</p>
          )}
        </div>
      </div>
    </button>
  );
}

// === MINIMAL PRODUCT CARD === (Clean, warm tones)
function MinimalProductCard({ product, onClick, accentColor }: ProductCardProps) {
  return (
    <button onClick={onClick} className={`bg-[#faf9f6] rounded-xl overflow-hidden text-left group transition-all hover:shadow-md w-full border border-stone-200/50 ${product.is_sold_out ? 'opacity-80' : ''}`}>
      <div className="relative overflow-hidden">
        {product.is_sold_out && <SoldOutOverlay />}
        <ProductBadges badges={(product as any).badges} />
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full aspect-square bg-stone-100 flex items-center justify-center"><Package className="h-10 w-10 text-stone-300" /></div>
        )}
        {product.sale_price && (
          <div className="absolute top-2 left-2 text-white text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: accentColor }}>
            -{Math.round(((product.price - product.sale_price) / product.price) * 100)}%
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-xs line-clamp-2 min-h-[2rem] leading-tight text-stone-700">{product.name}</p>
        <div className="mt-2">
          {product.sale_price ? (
            <div className="space-y-0.5">
              <p className="text-[11px] text-stone-400 line-through">{formatNumber(product.price)}đ</p>
              <p className="font-semibold text-sm" style={{ color: accentColor }}>{formatNumber(product.sale_price)}đ</p>
            </div>
          ) : (
            <p className="font-semibold text-sm text-stone-800">{formatNumber(product.price)}đ</p>
          )}
        </div>
      </div>
    </button>
  );
}

// === SHOPEE PRODUCT CARD === (Promo badges, orange accents)
function ShopeeProductCard({ product, onClick, accentColor }: ProductCardProps) {
  const discount = product.sale_price ? Math.round(((product.price - product.sale_price) / product.price) * 100) : 0;
  return (
    <button onClick={onClick} className={`bg-white rounded-lg overflow-hidden text-left group transition-all hover:shadow-lg w-full border border-gray-200 relative ${product.is_sold_out ? 'opacity-80' : ''}`}>
      {product.is_sold_out && <SoldOutOverlay />}
        <ProductBadges badges={(product as any).badges} />
      {discount > 0 && (
        <div className="absolute top-0 right-0 z-10 bg-gradient-to-br from-orange-500 to-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
          -{discount}%
        </div>
      )}
      <div className="relative overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full aspect-square bg-orange-50 flex items-center justify-center"><Package className="h-10 w-10 text-orange-200" /></div>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        <p className="font-medium text-xs line-clamp-2 min-h-[2rem] text-gray-800">{product.name}</p>
        <div>
          {product.sale_price ? (
            <>
              <p className="font-bold text-sm text-red-600">{formatNumber(product.sale_price)}đ</p>
              <p className="text-[10px] text-gray-400 line-through">{formatNumber(product.price)}đ</p>
            </>
          ) : (
            <p className="font-bold text-sm text-orange-600">{formatNumber(product.price)}đ</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] bg-red-50 text-red-500 font-medium px-1.5 py-0.5 rounded border border-red-100">🔥 Bán chạy</span>
        </div>
      </div>
    </button>
  );
}

// === ORGANIC PRODUCT CARD === (Natural, earthy)
function OrganicProductCard({ product, onClick, accentColor }: ProductCardProps) {
  return (
    <button onClick={onClick} className={`bg-white rounded-2xl overflow-hidden text-left group transition-all hover:shadow-md w-full border border-green-100 ${product.is_sold_out ? 'opacity-80' : ''}`}>
      <div className="relative overflow-hidden">
        {product.is_sold_out && <SoldOutOverlay />}
        <ProductBadges badges={(product as any).badges} />
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full aspect-square bg-green-50 flex items-center justify-center"><Package className="h-10 w-10 text-green-300" /></div>
        )}
        {product.sale_price && (
          <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            -{Math.round(((product.price - product.sale_price) / product.price) * 100)}%
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-xs line-clamp-2 min-h-[2rem] leading-tight text-green-900">{product.name}</p>
        <div className="mt-2">
          {product.sale_price ? (
            <div className="space-y-0.5">
              <p className="text-[11px] text-green-400 line-through">{formatNumber(product.price)}đ</p>
              <p className="font-bold text-sm text-green-700">{formatNumber(product.sale_price)}đ</p>
            </div>
          ) : (
            <p className="font-bold text-sm text-green-800">{formatNumber(product.price)}đ</p>
          )}
        </div>
      </div>
    </button>
  );
}

// === RESOLVER ===
export function LayoutProductCard({ layoutStyle, ...props }: ProductCardProps & { layoutStyle: LayoutStyle }) {
  switch (layoutStyle) {
    case 'tgdd': return <TGDDProductCard {...props} />;
    case 'hasaki': return <HasakiProductCard {...props} />;
    case 'nike':
    case 'canifa': return <NikeProductCard {...props} />;
    case 'luxury': return <LuxuryProductCard {...props} />;
    case 'minimal': return <MinimalProductCard {...props} />;
    case 'shopee': return <ShopeeProductCard {...props} />;
    case 'organic': return <OrganicProductCard {...props} />;
    case 'apple':
    default: return <AppleProductCard {...props} />;
  }
}

// Grid class resolver - different grid layouts per style
export function getProductGridClass(layoutStyle: LayoutStyle): string {
  switch (layoutStyle) {
    case 'nike':
    case 'canifa':
      return 'grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-8';
    case 'tgdd':
      return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3';
    case 'hasaki':
      return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4';
    case 'luxury':
      return 'grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8';
    case 'shopee':
      return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2';
    case 'organic':
      return 'grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5';
    default:
      return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6';
  }
}
