import { LandingProduct } from '@/hooks/useLandingProducts';
import { LayoutStyle } from '@/lib/industryConfig';
import { formatNumber } from '@/lib/formatNumber';
import { Package, Star, Zap, ShoppingBag } from 'lucide-react';
import { PRODUCT_BADGE_OPTIONS } from '@/components/admin/LandingProductsTab';

// === FIXED BADGE POSITION MAP ===
// Mỗi nhãn được gán cố định 1 trong 4 góc để đảm bảo nhất quán giữa admin & website,
// và để chặn việc chọn 2 nhãn cùng góc (trồng lên nhau).
export type BadgeCorner = 'tl' | 'tr' | 'bl' | 'br';
export type BadgeVariant = 'pill' | 'flame';
export const BADGE_POSITION_MAP: Record<string, { corner: BadgeCorner; variant: BadgeVariant }> = {
  // === TOP-LEFT (tl): Hàng mới / Mới về / Phiên bản ===
  new:            { corner: 'tl', variant: 'pill' },
  new_today:      { corner: 'tl', variant: 'pill' },
  just_updated:   { corner: 'tl', variant: 'pill' },
  new_version:    { corner: 'tl', variant: 'pill' },
  preorder:       { corner: 'tl', variant: 'pill' },
  trending:       { corner: 'tl', variant: 'pill' },

  // === TOP-RIGHT (tr): Hot / Sale / Deal / FOMO ===
  hot:            { corner: 'tr', variant: 'flame' },
  sale:           { corner: 'tr', variant: 'flame' },
  deal:           { corner: 'tr', variant: 'flame' },
  clearance:      { corner: 'tr', variant: 'flame' },
  hot_deal:       { corner: 'tr', variant: 'flame' },
  shock_deal:     { corner: 'tr', variant: 'flame' },
  flash_sale:     { corner: 'tr', variant: 'flame' },
  almost_sold:    { corner: 'tr', variant: 'flame' },
  few_left:       { corner: 'tr', variant: 'flame' },
  today_hot:      { corner: 'tr', variant: 'flame' },
  limited_deal:   { corner: 'tr', variant: 'flame' },
  price_up_soon:  { corner: 'tr', variant: 'flame' },
  best_seller:    { corner: 'tr', variant: 'pill' },
  top_1:          { corner: 'tr', variant: 'pill' },
  many_buy:       { corner: 'tr', variant: 'pill' },

  // === BOTTOM-RIGHT (br): Cao cấp / Chất lượng / Bảo hành / Chính hãng ===
  genuine:        { corner: 'br', variant: 'pill' },
  quality:        { corner: 'br', variant: 'pill' },
  premium:        { corner: 'br', variant: 'pill' },
  premium_en:     { corner: 'br', variant: 'pill' },
  flagship:       { corner: 'br', variant: 'pill' },
  super_product:  { corner: 'br', variant: 'pill' },
  must_own:       { corner: 'br', variant: 'pill' },
  top_tier:       { corner: 'br', variant: 'pill' },
  exclusive:      { corner: 'br', variant: 'pill' },
  limited:        { corner: 'br', variant: 'pill' },
  rare:           { corner: 'br', variant: 'pill' },
  unique:         { corner: 'br', variant: 'pill' },
  limited_stock:  { corner: 'br', variant: 'pill' },

  // === BOTTOM-LEFT (bl): Giá / Ưu đãi / Đánh giá / Đề xuất ===
  popular:        { corner: 'bl', variant: 'pill' },
  best_choice:    { corner: 'bl', variant: 'pill' },
  good_price:     { corner: 'bl', variant: 'pill' },
  worth_buy:      { corner: 'bl', variant: 'pill' },
  worth_money:    { corner: 'bl', variant: 'pill' },
  high_rated:     { corner: 'bl', variant: 'pill' },
  good_review:    { corner: 'bl', variant: 'pill' },
  customer_pick:  { corner: 'bl', variant: 'pill' },
  staff_pick:     { corner: 'bl', variant: 'pill' },
  best_price:     { corner: 'bl', variant: 'pill' },
  internal_price: { corner: 'bl', variant: 'pill' },
  wholesale_price:{ corner: 'bl', variant: 'pill' },
  combo_save:     { corner: 'bl', variant: 'pill' },
  free_gift:      { corner: 'bl', variant: 'pill' },
  special_offer:  { corner: 'bl', variant: 'pill' },
  warranty:       { corner: 'bl', variant: 'pill' },
};

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

// === STUDENT DISCOUNT BADGE ===
// Tem đỏ kiểu "BEST SELLER" — nền đỏ, chữ trắng in hoa, bo góc nhẹ, có mũi tên ribbon bên phải
export function StudentDiscountBadge({ label, text }: { label?: string | null; text?: string | null }) {
  if (!text || !text.trim()) return null;
  const title = (label || 'HỌC SINH SINH VIÊN').toUpperCase();
  const content = text.toUpperCase();
  return (
    <div className="inline-flex items-stretch text-[10px] sm:text-[11px] font-extrabold text-white shadow-md select-none">
      {/* Khối tiêu đề (đỏ đậm) */}
      <div
        className="px-2.5 py-1 rounded-l-md flex items-center"
        style={{ background: '#dc2626', lineHeight: 1.05 }}
      >
        <span className="whitespace-pre-line text-center" style={{ letterSpacing: '0.02em' }}>
          {title.split(' ').slice(0, 2).join(' ')}
          {title.split(' ').length > 2 ? '\n' + title.split(' ').slice(2).join(' ') : ''}
        </span>
      </div>
      {/* Khối nội dung (đỏ tươi) + ribbon đuôi tam giác */}
      <div className="relative flex items-center px-2.5 py-1" style={{ background: '#ef4444' }}>
        <span style={{ letterSpacing: '0.02em' }}>{content}</span>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: -8,
            top: 0,
            bottom: 0,
            width: 0,
            height: 0,
            borderTop: '13px solid transparent',
            borderBottom: '13px solid transparent',
            borderLeft: '8px solid #ef4444',
          }}
        />
      </div>
    </div>
  );
}

// === INSTALLMENT LINE ===
// Dòng "Hoặc trả trước XXX,000đ" hiển thị bên dưới giá
export function InstallmentLine({ amount }: { amount?: number | null }) {
  if (!amount || amount <= 0) return null;
  return (
    <p className="text-[11px] sm:text-xs text-gray-600 mt-1 leading-tight">
      Hoặc trả trước{' '}
      <span className="font-semibold text-red-600 whitespace-nowrap">
        {formatNumber(amount)}đ
      </span>
    </p>
  );
}

// Shared badge overlay for product cards
export function ProductBadges({ badges, style }: { badges?: string[]; style?: 'simple' | 'luxury' | string }) {
  if (!badges || badges.length === 0) return null;
  const items = badges.slice(0, 3).map(b => PRODUCT_BADGE_OPTIONS.find(o => o.id === b)).filter(Boolean);
  if (items.length === 0) return null;
  const badgeStyle: 'simple' | 'luxury' = style === 'luxury' ? 'luxury' : 'simple';

  const getBadgeGradient = (opt: typeof PRODUCT_BADGE_OPTIONS[0]) => {
    // Đồng bộ với bảng màu Tailwind để khớp với preview admin
    const gradients: Record<string, string> = {
      // red
      'bg-red-500': '#ef4444', 'bg-red-600': '#dc2626', 'bg-red-700': '#b91c1c',
      // orange
      'bg-orange-500': '#f97316', 'bg-orange-600': '#ea580c', 'bg-orange-700': '#c2410c',
      // amber
      'bg-amber-500': '#f59e0b', 'bg-amber-600': '#d97706', 'bg-amber-700': '#b45309',
      // yellow
      'bg-yellow-500': '#eab308', 'bg-yellow-600': '#ca8a04', 'bg-yellow-700': '#a16207',
      // lime
      'bg-lime-500': '#84cc16', 'bg-lime-600': '#65a30d', 'bg-lime-700': '#4d7c0f',
      // green
      'bg-green-500': '#22c55e', 'bg-green-600': '#16a34a', 'bg-green-700': '#15803d',
      // emerald
      'bg-emerald-500': '#10b981', 'bg-emerald-600': '#059669', 'bg-emerald-700': '#047857',
      // teal
      'bg-teal-500': '#14b8a6', 'bg-teal-600': '#0d9488', 'bg-teal-700': '#0f766e',
      // cyan
      'bg-cyan-500': '#06b6d4', 'bg-cyan-600': '#0891b2', 'bg-cyan-700': '#0e7490',
      // sky
      'bg-sky-500': '#0ea5e9', 'bg-sky-600': '#0284c7', 'bg-sky-700': '#0369a1',
      // blue
      'bg-blue-500': '#3b82f6', 'bg-blue-600': '#2563eb', 'bg-blue-700': '#1d4ed8',
      // indigo
      'bg-indigo-500': '#6366f1', 'bg-indigo-600': '#4f46e5', 'bg-indigo-700': '#4338ca',
      // violet
      'bg-violet-500': '#8b5cf6', 'bg-violet-600': '#7c3aed', 'bg-violet-700': '#6d28d9',
      // purple
      'bg-purple-500': '#a855f7', 'bg-purple-600': '#9333ea', 'bg-purple-700': '#7e22ce',
      // fuchsia
      'bg-fuchsia-500': '#d946ef', 'bg-fuchsia-600': '#c026d3', 'bg-fuchsia-700': '#a21caf',
      // pink
      'bg-pink-500': '#ec4899', 'bg-pink-600': '#db2777', 'bg-pink-700': '#be185d',
      // rose
      'bg-rose-500': '#f43f5e', 'bg-rose-600': '#e11d48', 'bg-rose-700': '#be123c',
      // slate / zinc / neutral (dark premium)
      'bg-slate-700': '#334155', 'bg-slate-800': '#1e293b', 'bg-slate-900': '#0f172a',
      'bg-zinc-700': '#3f3f46', 'bg-zinc-800': '#27272a', 'bg-zinc-900': '#18181b',
      'bg-neutral-700': '#404040', 'bg-neutral-800': '#262626', 'bg-neutral-900': '#171717',
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
  const BADGE_LAYOUT = BADGE_POSITION_MAP;

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
            // Dùng đúng màu của nhãn để đồng bộ với preview admin (không pha cam-đỏ cố định)
            background: baseColor,
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
            [isRight ? 'borderRight' : 'borderLeft']: `10px solid ${baseColor}`,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
            } as any}
          />
        </div>
      </div>
    );
  };

  // === LUXURY (Royal Luxe) BADGE ===
  // Thiết kế: huy chương tròn răng cưa nhỏ đều (gear-edge) màu vàng kim với chữ cái serif
  // ở giữa, ghép với ribbon chữ nhật bo góc nhẹ, viền vàng mảnh, gradient nền sậm sang trọng.
  // Khớp y hệt ảnh tham chiếu (medallion + tablet ribbon).
  const LuxuryBadge = ({ opt, corner }: { opt: typeof PRODUCT_BADGE_OPTIONS[0]; corner: Corner }) => {
    const [, highlight] = splitLabel(opt.id, opt.text);
    const baseColor = getBadgeGradient(opt);
    const isRight = corner === 'tr' || corner === 'br';
    const isBottom = corner === 'bl' || corner === 'br';
    // Subtitle mặc định cho một số nhãn 2 dòng (như mẫu "CHÍNH HÃNG / ĐẢM BẢO")
    const SUBTITLE_MAP: Record<string, string> = {
      genuine: 'ĐẢM BẢO',
      quality: 'CAO CẤP',
      premium: 'CAO CẤP',
      warranty: 'CHÍNH HÃNG',
      exclusive: 'PHIÊN BẢN',
      limited: 'SỐ LƯỢNG',
    };
    const subtitle = SUBTITLE_MAP[opt.id];

    // Gradient nền sậm sang trọng theo màu nhãn (giữ tone gốc nhưng deep + bóng)
    const ribbonBg = `linear-gradient(180deg, ${baseColor} 0%, rgba(0,0,0,0.55) 100%), ${baseColor}`;

    // Răng cưa nhỏ đều (~20 răng) cho viền medallion
    const TOOTH_COUNT = 22;
    const teethStops: string[] = [];
    const step = 360 / TOOTH_COUNT;
    for (let i = 0; i < TOOTH_COUNT; i++) {
      const a = i * step;
      teethStops.push(`#fde68a ${a}deg ${a + step / 2}deg`);
      teethStops.push(`#b45309 ${a + step / 2}deg ${a + step}deg`);
    }
    const teethGradient = `conic-gradient(${teethStops.join(', ')})`;

    const SEAL_SIZE = 32;

    const seal = (
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{
          width: SEAL_SIZE,
          height: SEAL_SIZE,
          [isRight ? 'marginLeft' : 'marginRight']: -8,
          zIndex: 2,
        } as any}
      >
        {/* Răng cưa ngoài cùng */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: teethGradient,
            WebkitMask: 'radial-gradient(circle, transparent 62%, #000 64%, #000 100%)',
            mask: 'radial-gradient(circle, transparent 62%, #000 64%, #000 100%)',
            filter: 'drop-shadow(0 0 0.5px rgba(0,0,0,0.6))',
          }}
        />
        {/* Mặt huy chương (đĩa kim loại bóng) */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 3,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 32% 28%, #fef3c7 0%, #fbbf24 38%, #b45309 92%)',
            boxShadow:
              'inset 0 0 0 1px #78350f, inset 0 -2px 3px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.45)',
          }}
        />
        {/* Vòng tròn nội điểm chấm (tùy chọn — tăng chi tiết) */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 5,
            borderRadius: '50%',
            border: '0.5px dashed rgba(120,53,15,0.55)',
          }}
        />
        {/* Chữ cái trong huy chương */}
        <span
          style={{
            position: 'relative',
            zIndex: 2,
            fontSize: 15,
            fontWeight: 900,
            color: '#3f1d04',
            fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
            fontStyle: 'italic',
            textShadow:
              '0 1px 0 rgba(255,255,255,0.55), 0 -1px 0 rgba(0,0,0,0.25)',
            lineHeight: 1,
          }}
        >
          {(opt.text || 'V').trim().charAt(0).toUpperCase()}
        </span>
      </div>
    );

    const ribbon = (
      <div
        style={{
          position: 'relative',
          background: ribbonBg,
          color: '#fff7ed',
          padding: subtitle
            ? (isRight ? '4px 10px 4px 18px' : '4px 18px 4px 10px')
            : (isRight ? '6px 10px 6px 18px' : '6px 18px 6px 10px'),
          fontSize: subtitle ? 10 : 11,
          fontWeight: 800,
          letterSpacing: '0.08em',
          whiteSpace: 'nowrap',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1.1,
          textTransform: 'uppercase',
          textShadow: '0 1px 1px rgba(0,0,0,0.6)',
          fontFamily: '"Playfair Display", Georgia, serif',
          borderRadius: 4,
          // Viền vàng kim loại + highlight + đáy tối tạo chiều sâu
          boxShadow:
            'inset 0 0 0 1.2px #fbbf24, inset 0 0 0 2px rgba(120,53,15,0.6), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 0 rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        <span>{highlight}</span>
        {subtitle && (
          <span
            style={{
              fontSize: 8.5,
              letterSpacing: '0.12em',
              fontWeight: 700,
              opacity: 0.95,
              marginTop: 1,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    );

    return (
      <div className={`absolute z-10 animate-badge-pulse ${cornerClass(corner)}`}>
        <div
          className="flex items-center select-none"
          style={{
            filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.4))',
            flexDirection: isRight ? 'row-reverse' : 'row',
          }}
        >
          {seal}
          {ribbon}
        </div>
      </div>
    );
  };

  // Each badge has a FIXED corner (BADGE_POSITION_MAP). Nếu admin lỡ chọn 2 nhãn cùng góc,
  // chỉ giữ nhãn đầu tiên ở góc đó để không trồng lên nhau.
  const fallbackOrder: Corner[] = ['tr', 'tl', 'bl', 'br'];
  const usedCorners = new Set<Corner>();
  const assignments: { opt: typeof PRODUCT_BADGE_OPTIONS[0]; corner: Corner; variant: Variant }[] = [];

  items.forEach((opt, idx) => {
    const layout = BADGE_LAYOUT[opt!.id] || { corner: fallbackOrder[idx] as Corner, variant: 'pill' as Variant };
    if (usedCorners.has(layout.corner)) return; // skip duplicates per corner
    usedCorners.add(layout.corner);
    assignments.push({ opt: opt!, corner: layout.corner, variant: layout.variant });
  });

  return (
    <>
      {assignments.map(({ opt, corner, variant }) =>
        badgeStyle === 'luxury'
          ? <LuxuryBadge key={opt.id} opt={opt} corner={corner} />
          : variant === 'flame'
          ? <FlameBadge key={opt.id} opt={opt} corner={corner} />
          : <PillBadge key={opt.id} opt={opt} corner={corner} />,
      )}
    </>
  );
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
        <ProductBadges badges={(product as any).badges} style={(product as any).badge_style} />
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
        {(product as any).student_discount_text && (
          <div className="mt-2">
            <StudentDiscountBadge label={(product as any).student_discount_label} text={(product as any).student_discount_text} />
          </div>
        )}
        <div className="mt-2">
          {product.sale_price ? (
            <div className="space-y-0.5">
              <p className="text-xs text-[#86868b] line-through">{formatNumber(product.price)}đ</p>
              <p className="font-bold text-sm text-red-600">{formatNumber(product.sale_price)}đ</p>
            </div>
          ) : (
            <p className="font-bold text-sm text-[#1d1d1f]">{formatNumber(product.price)}đ</p>
          )}
          <InstallmentLine amount={(product as any).installment_down_payment} />
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
        <ProductBadges badges={(product as any).badges} style={(product as any).badge_style} />
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
        {(product as any).student_discount_text && (
          <StudentDiscountBadge label={(product as any).student_discount_label} text={(product as any).student_discount_text} />
        )}
        <div>
          {product.sale_price ? (
            <>
              <p className="font-extrabold text-sm text-red-600">{formatNumber(product.sale_price)}đ</p>
              <p className="text-[11px] text-gray-400 line-through">{formatNumber(product.price)}đ</p>
            </>
          ) : (
            <p className="font-extrabold text-sm text-blue-700">{formatNumber(product.price)}đ</p>
          )}
          <InstallmentLine amount={(product as any).installment_down_payment} />
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
        <ProductBadges badges={(product as any).badges} style={(product as any).badge_style} />
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
        {(product as any).student_discount_text && (
          <StudentDiscountBadge label={(product as any).student_discount_label} text={(product as any).student_discount_text} />
        )}
        <div>
          {product.sale_price ? (
            <div className="flex items-baseline gap-2">
              <p className="font-bold text-sm text-red-600">{formatNumber(product.sale_price)}đ</p>
              <p className="text-[10px] text-gray-400 line-through">{formatNumber(product.price)}đ</p>
            </div>
          ) : (
            <p className="font-bold text-sm text-gray-900">{formatNumber(product.price)}đ</p>
          )}
          <InstallmentLine amount={(product as any).installment_down_payment} />
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
        <ProductBadges badges={(product as any).badges} style={(product as any).badge_style} />
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
        {(product as any).student_discount_text && (
          <StudentDiscountBadge label={(product as any).student_discount_label} text={(product as any).student_discount_text} />
        )}
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
        <InstallmentLine amount={(product as any).installment_down_payment} />
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
        <ProductBadges badges={(product as any).badges} style={(product as any).badge_style} />
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
        {(product as any).student_discount_text && (
          <div className="flex justify-center"><StudentDiscountBadge label={(product as any).student_discount_label} text={(product as any).student_discount_text} /></div>
        )}
        <div>
          {product.sale_price ? (
            <div className="space-y-0.5">
              <p className="text-xs text-gray-400 line-through">{formatNumber(product.price)}đ</p>
              <p className="font-semibold text-sm text-amber-800">{formatNumber(product.sale_price)}đ</p>
            </div>
          ) : (
            <p className="font-semibold text-sm text-gray-900">{formatNumber(product.price)}đ</p>
          )}
          <InstallmentLine amount={(product as any).installment_down_payment} />
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
        <ProductBadges badges={(product as any).badges} style={(product as any).badge_style} />
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
        {(product as any).student_discount_text && (
          <div className="mt-1.5"><StudentDiscountBadge label={(product as any).student_discount_label} text={(product as any).student_discount_text} /></div>
        )}
        <div className="mt-2">
          {product.sale_price ? (
            <div className="space-y-0.5">
              <p className="text-[11px] text-stone-400 line-through">{formatNumber(product.price)}đ</p>
              <p className="font-semibold text-sm" style={{ color: accentColor }}>{formatNumber(product.sale_price)}đ</p>
            </div>
          ) : (
            <p className="font-semibold text-sm text-stone-800">{formatNumber(product.price)}đ</p>
          )}
          <InstallmentLine amount={(product as any).installment_down_payment} />
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
        <ProductBadges badges={(product as any).badges} style={(product as any).badge_style} />
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
        {(product as any).student_discount_text && (
          <StudentDiscountBadge label={(product as any).student_discount_label} text={(product as any).student_discount_text} />
        )}
        <div>
          {product.sale_price ? (
            <>
              <p className="font-bold text-sm text-red-600">{formatNumber(product.sale_price)}đ</p>
              <p className="text-[10px] text-gray-400 line-through">{formatNumber(product.price)}đ</p>
            </>
          ) : (
            <p className="font-bold text-sm text-orange-600">{formatNumber(product.price)}đ</p>
          )}
          <InstallmentLine amount={(product as any).installment_down_payment} />
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
        <ProductBadges badges={(product as any).badges} style={(product as any).badge_style} />
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
        {(product as any).student_discount_text && (
          <div className="mt-1.5"><StudentDiscountBadge label={(product as any).student_discount_label} text={(product as any).student_discount_text} /></div>
        )}
        <div className="mt-2">
          {product.sale_price ? (
            <div className="space-y-0.5">
              <p className="text-[11px] text-green-400 line-through">{formatNumber(product.price)}đ</p>
              <p className="font-bold text-sm text-green-700">{formatNumber(product.sale_price)}đ</p>
            </div>
          ) : (
            <p className="font-bold text-sm text-green-800">{formatNumber(product.price)}đ</p>
          )}
          <InstallmentLine amount={(product as any).installment_down_payment} />
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
