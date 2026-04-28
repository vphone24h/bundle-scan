import { LandingProduct } from '@/hooks/useLandingProducts';
import { LayoutStyle } from '@/lib/industryConfig';
import { formatNumber } from '@/lib/formatNumber';
import { Package, Star, Zap, ShoppingBag } from 'lucide-react';
import { PRODUCT_BADGE_OPTIONS } from '@/components/admin/LandingProductsTab';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenantRatingStats } from '@/hooks/useLandingProductReviews';

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

// === EXTRA DISCOUNT BADGE ===
// Style theo ảnh tham khảo (Samsung): pill rộng, nền pastel theo màu, chữ thường + số tiền nổi bật
export function ExtraDiscountBadge({
  label,
  text,
  color,
}: {
  label?: string | null;
  text?: string | null;
  color?: string | null;
}) {
  if (!text || !text.trim()) return null;
  const c = (color || '#3b82f6').trim();
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] sm:text-xs font-medium select-none w-full"
      style={{
        background: `${c}1A`, // ~10% opacity
        color: c,
      }}
    >
      <span className="truncate">{label || 'Ưu đãi'}</span>
      <span className="font-bold whitespace-nowrap ml-auto">{text}</span>
    </div>
  );
}

// Bộ màu mặc định cho các nhãn ưu đãi bổ sung
export const EXTRA_DISCOUNT_COLORS = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#db2777'];

// === STACK: nhãn HS-SV chính + các nhãn ưu đãi bổ sung ===
export function DiscountBadgesStack({
  product,
  align = 'start',
}: {
  product: any;
  align?: 'start' | 'center';
}) {
  const main = product?.student_discount_text;
  const extras: Array<{ label: string; text: string; color?: string }> = Array.isArray(product?.extra_discount_labels)
    ? product.extra_discount_labels.filter((x: any) => x && x.text && String(x.text).trim())
    : [];
  if (!main && extras.length === 0) return null;
  return (
    <div className={`flex flex-col gap-1 ${align === 'center' ? 'items-center' : 'items-start'} w-full`}>
      {main ? (
        <StudentDiscountBadge label={product?.student_discount_label} text={main} />
      ) : null}
      {extras.slice(0, 4).map((it, idx) => (
        <ExtraDiscountBadge
          key={idx}
          label={it.label}
          text={it.text}
          color={it.color || EXTRA_DISCOUNT_COLORS[idx % EXTRA_DISCOUNT_COLORS.length]}
        />
      ))}
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

/** Hiển thị "Đã bán XXX" — tự ẩn khi sold_count<=0 hoặc show_sold_count=false. */
export function SoldCountLine({ product }: { product: any }) {
  const show = product?.show_sold_count !== false; // mặc định bật
  const count = Number(product?.sold_count ?? 0);
  if (!show || count <= 0) return null;
  return (
    <p className="text-[10px] sm:text-[11px] text-gray-500 mt-1 leading-tight">
      🔥 Đã bán <span className="font-semibold text-orange-600">{formatNumber(count)}</span>
    </p>
  );
}

/** Hiển thị "★ 4.9 (165)" — tự ẩn nếu chưa có đánh giá. */
export function RatingLine({ product, inline = false }: { product: any; inline?: boolean }) {
  const { data: stats } = useTenantRatingStats(product?.tenant_id);
  const s = stats?.[product?.id];
  if (!s || s.count <= 0) return null;
  return (
    <span
      className={
        inline
          ? 'inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] text-gray-600 leading-tight'
          : 'flex items-center gap-0.5 text-[10px] sm:text-[11px] text-gray-600 mt-1 leading-tight'
      }
    >
      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      <span className="font-semibold text-gray-800">{s.avg.toFixed(1)}</span>
      <span className="text-gray-500">({formatNumber(s.count)})</span>
    </span>
  );
}

/** Combined inline: ★ 4.9 (165) · Đã bán 1.484 */
export function RatingAndSoldLine({ product }: { product: any }) {
  const { data: stats } = useTenantRatingStats(product?.tenant_id);
  const s = stats?.[product?.id];
  const showSold = product?.show_sold_count !== false;
  const soldCount = Number(product?.sold_count ?? 0);
  const hasRating = s && s.count > 0;
  const hasSold = showSold && soldCount > 0;
  if (!hasRating && !hasSold) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] leading-tight flex-wrap">
      {hasRating && (
        <span className="inline-flex items-center gap-0.5">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold text-gray-800">{s.avg.toFixed(1)}</span>
          <span className="text-gray-500">({formatNumber(s.count)})</span>
        </span>
      )}
      {hasRating && hasSold && <span className="text-gray-300">·</span>}
      {hasSold && (
        <span className="text-gray-500">
          🔥 Đã bán <span className="font-semibold text-orange-600">{formatNumber(soldCount)}</span>
        </span>
      )}
    </div>
  );
}

// Shared badge overlay for product cards
export function ProductBadges({ badges, style }: { badges?: string[]; style?: 'simple' | 'luxury' | 'modern' | 'tiktok' | string }) {
  if (!badges || badges.length === 0) return null;
  const items = badges.slice(0, 3).map(b => PRODUCT_BADGE_OPTIONS.find(o => o.id === b)).filter(Boolean);
  if (items.length === 0) return null;
  const badgeStyle: 'simple' | 'luxury' | 'modern' | 'tiktok' =
    style === 'luxury' ? 'luxury'
    : style === 'modern' ? 'modern'
    : style === 'tiktok' ? 'tiktok'
    : 'simple';
  const isMobile = useIsMobile();

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
  const activeCorners = new Set(items.map(opt => BADGE_LAYOUT[opt!.id]?.corner).filter(Boolean) as Corner[]);
  const hasTopPair = activeCorners.has('tl') && activeCorners.has('tr');
  const hasBottomPair = activeCorners.has('bl') && activeCorners.has('br');

  const cornerClass = (c: Corner) => {
    switch (c) {
      // Simple style: hug the image edge (flush), only outer side will be rounded
      case 'tl': return 'top-3 left-0';
      case 'tr': return 'top-3 right-0';
      case 'bl': return 'bottom-3 left-0';
      case 'br': return 'bottom-3 right-0';
    }
  };

  const getLuxuryCornerStyle = (corner: Corner) => {
    if (!isMobile) {
      switch (corner) {
        case 'tl': return { top: 8, left: 8, transform: 'scale(0.5)', transformOrigin: 'top left' };
        case 'tr': return { top: 8, right: 8, transform: 'scale(0.5)', transformOrigin: 'top right' };
        case 'bl': return { bottom: 8, left: 8, transform: 'scale(0.5)', transformOrigin: 'bottom left' };
        case 'br': return { bottom: 8, right: 8, transform: 'scale(0.5)', transformOrigin: 'bottom right' };
      }
    }

    switch (corner) {
      case 'tl':
        return { top: 6, left: 4, transform: 'scale(0.42)', transformOrigin: 'top left' };
      case 'tr':
        return { top: 5, right: 4, transform: 'scale(0.42)', transformOrigin: 'top right' };
      case 'bl':
        return { bottom: 5, left: 4, transform: 'scale(0.42)', transformOrigin: 'bottom left' };
      case 'br':
        return { bottom: 5, right: 4, transform: 'scale(0.42)', transformOrigin: 'bottom right' };
    }
  };

  const PillBadge = ({ opt, corner }: { opt: typeof PRODUCT_BADGE_OPTIONS[0]; corner: Corner }) => {
    const [prefix, highlight] = splitLabel(opt.id, opt.text);
    const isLeft = corner === 'tl' || corner === 'bl';
    // Flush against the card edge: square corners on the edge side, rounded on the outer side
    const borderRadius = isLeft
      ? '0 999px 999px 0'
      : '999px 0 0 999px';
    return (
      <div
        className={`absolute z-10 animate-badge-pulse flex items-center gap-1 ${cornerClass(corner)}`}
        style={{
          background: getBadgeGradient(opt),
          color: '#fff',
          padding: isLeft ? '5px 14px 5px 10px' : '5px 10px 5px 14px',
          borderRadius,
          boxShadow: isLeft
            ? '2px 3px 8px rgba(0,0,0,0.22)'
            : '-2px 3px 8px rgba(0,0,0,0.22)',
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
  // Thiết kế theo ảnh mẫu:
  // - HÀNG MỚI: seal tròn chữ N + ribbon đỏ kéo dài sang phải, đầu phải cắt xéo.
  // - SẢN PHẨM BÁN CHẠY: ribbon xanh nghiêng hiện đại, đầu phải cắt xéo.
  // - Các nhãn trust còn lại: huy hiệu + ribbon nhỏ.
  const LuxuryBadge = ({ opt, corner }: { opt: typeof PRODUCT_BADGE_OPTIONS[0]; corner: Corner }) => {
    const [, highlight] = splitLabel(opt.id, opt.text);
    const baseColor = getBadgeGradient(opt);
    const isRight = corner === 'tr' || corner === 'br';
    const NEW_BADGE_IDS = new Set(['new', 'new_today', 'just_updated', 'new_version', 'preorder', 'trending']);
    const BEST_SELLER_BADGE_IDS = new Set(['best_seller', 'top_1', 'many_buy']);

    const SUBTITLE_MAP: Record<string, string> = {
      genuine: 'ĐẢM BẢO',
      quality: 'CAO CẤP',
      premium: 'CAO CẤP',
      warranty: 'CHÍNH HÃNG',
      exclusive: 'PHIÊN BẢN',
      limited: 'SỐ LƯỢNG',
    };
    const subtitle = SUBTITLE_MAP[opt.id];

    type Tone = { from: string; to: string; sealFrom: string; sealTo: string };
    const TONE_MAP: Record<string, Tone> = {
      new:          { from: '#C62828', to: '#7A0F1A', sealFrom: '#A0151E', sealTo: '#5B0A11' },
      new_today:    { from: '#C62828', to: '#7A0F1A', sealFrom: '#A0151E', sealTo: '#5B0A11' },
      just_updated: { from: '#C62828', to: '#7A0F1A', sealFrom: '#A0151E', sealTo: '#5B0A11' },
      new_version:  { from: '#C62828', to: '#7A0F1A', sealFrom: '#A0151E', sealTo: '#5B0A11' },
      preorder:     { from: '#C62828', to: '#7A0F1A', sealFrom: '#A0151E', sealTo: '#5B0A11' },
      trending:     { from: '#C62828', to: '#7A0F1A', sealFrom: '#A0151E', sealTo: '#5B0A11' },
      hot:          { from: '#C62828', to: '#7A0F1A', sealFrom: '#A0151E', sealTo: '#5B0A11' },
      sale:         { from: '#C62828', to: '#7A0F1A', sealFrom: '#A0151E', sealTo: '#5B0A11' },
      deal:         { from: '#C62828', to: '#7A0F1A', sealFrom: '#A0151E', sealTo: '#5B0A11' },
      best_seller:  { from: '#3B82F6', to: '#1E3A8A', sealFrom: '#2563EB', sealTo: '#172554' },
      top_1:        { from: '#3B82F6', to: '#1E3A8A', sealFrom: '#2563EB', sealTo: '#172554' },
      many_buy:     { from: '#3B82F6', to: '#1E3A8A', sealFrom: '#2563EB', sealTo: '#172554' },
      genuine:      { from: '#22C55E', to: '#166534', sealFrom: '#15803D', sealTo: '#0B3F1F' },
      warranty:     { from: '#22C55E', to: '#166534', sealFrom: '#15803D', sealTo: '#0B3F1F' },
      quality:      { from: '#22C55E', to: '#166534', sealFrom: '#15803D', sealTo: '#0B3F1F' },
      premium:      { from: '#22C55E', to: '#166534', sealFrom: '#15803D', sealTo: '#0B3F1F' },
      premium_en:   { from: '#22C55E', to: '#166534', sealFrom: '#15803D', sealTo: '#0B3F1F' },
      flagship:     { from: '#22C55E', to: '#166534', sealFrom: '#15803D', sealTo: '#0B3F1F' },
    };
    const tone: Tone = TONE_MAP[opt.id] || {
      from: baseColor, to: baseColor, sealFrom: baseColor, sealTo: baseColor,
    };
    const displayText = NEW_BADGE_IDS.has(opt.id)
      ? 'HÀNG MỚI'
      : BEST_SELLER_BADGE_IDS.has(opt.id)
      ? 'SẢN PHẨM BÁN CHẠY'
      : highlight;
    const sealLetter = NEW_BADGE_IDS.has(opt.id)
      ? 'N'
      : opt.id === 'genuine' || opt.id === 'warranty'
      ? 'H'
      : displayText.trim().charAt(0).toUpperCase();

    const makeSealGradient = (count: number) => {
      const stops: string[] = [];
      const step = 360 / count;
      for (let i = 0; i < count; i++) {
        const start = i * step;
        stops.push(`#fef3c7 ${start}deg ${start + step * 0.48}deg`);
        stops.push(`#8b5a16 ${start + step * 0.48}deg ${start + step}deg`);
      }
      return `conic-gradient(${stops.join(', ')})`;
    };

    if (NEW_BADGE_IDS.has(opt.id)) {
      return (
        <div className="absolute z-10" style={getLuxuryCornerStyle(corner)}>
          <div
            className="flex items-center select-none"
            style={{
              filter: 'drop-shadow(0 8px 12px rgba(60, 8, 15, 0.38))',
            }}
          >
            <div
              className="relative flex items-center justify-center shrink-0"
              style={{
                width: 46,
                height: 46,
                marginRight: -10,
                zIndex: 2,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: makeSealGradient(18),
                  boxShadow: '0 3px 7px rgba(0,0,0,0.28)',
                }}
              />
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 3,
                  borderRadius: '50%',
                  background: 'linear-gradient(145deg, #fde7a8 0%, #a96d20 45%, #f8d37a 72%, #855018 100%)',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -2px 3px rgba(88,46,8,0.45)',
                }}
              />
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 7,
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 30% 25%, ${tone.from} 0%, ${tone.sealFrom} 42%, ${tone.sealTo} 100%)`,
                  boxShadow: 'inset 0 0 0 1px rgba(255,235,186,0.6), inset 0 2px 4px rgba(255,255,255,0.18), inset 0 -4px 5px rgba(0,0,0,0.3)',
                }}
              />
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 10,
                  borderRadius: '50%',
                  border: '1px solid rgba(253, 230, 138, 0.7)',
                }}
              />
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  fontSize: 24,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: '#f7dfab',
                  fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
                  textShadow: '0 1px 0 rgba(72,22,12,0.9), 0 0 6px rgba(255,228,179,0.35)',
                }}
              >
                {sealLetter}
              </span>
            </div>

            <div
              style={{
                position: 'relative',
                padding: 2,
                borderRadius: 999,
                background: 'linear-gradient(180deg, #fef3c7 0%, #f3cf76 28%, #9a6520 100%)',
                clipPath: 'polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  minWidth: 118,
                  padding: '7px 28px 7px 20px',
                  borderRadius: 999,
                  clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)',
                  background: `linear-gradient(90deg, ${tone.to} 0%, ${tone.from} 54%, #7f1120 100%)`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -3px 6px rgba(61,10,17,0.35), inset 0 0 0 1px rgba(251,191,36,0.7)',
                  overflow: 'hidden',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: '0 0 auto 0',
                    height: '46%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)',
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'block',
                    color: '#fff8e7',
                    fontSize: 12.5,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    textShadow: '0 1px 2px rgba(0,0,0,0.45)',
                  }}
                >
                  {displayText}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (BEST_SELLER_BADGE_IDS.has(opt.id)) {
      return (
        <div className="absolute z-10" style={getLuxuryCornerStyle(corner)}>
          <div
            className="select-none"
            style={{
              filter: 'drop-shadow(0 8px 12px rgba(20, 44, 99, 0.28))',
            }}
          >
            <div
              style={{
                position: 'relative',
                padding: 2,
                borderRadius: 8,
                background: 'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 100%)',
                clipPath: 'polygon(4% 0, 100% 0, 100% 72%, 93% 100%, 0 100%, 5% 45%)',
                transform: 'skewX(-12deg)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  minWidth: 146,
                  padding: '7px 20px 7px 18px',
                  borderRadius: 7,
                  background: `linear-gradient(90deg, ${tone.to} 0%, #1d4ed8 42%, ${tone.from} 100%)`,
                  clipPath: 'polygon(4% 0, 100% 0, 100% 70%, 94% 100%, 0 100%, 5% 46%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -3px 5px rgba(8,26,76,0.32), 0 2px 4px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: '0 0 auto 0',
                    height: '44%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)',
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    right: 6,
                    bottom: -1,
                    width: 14,
                    height: 14,
                    background: '#1e3a8a',
                    clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.12)',
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'block',
                    transform: 'skewX(12deg)',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    textShadow: '0 1px 2px rgba(0,0,0,0.38)',
                  }}
                >
                  {displayText}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const SEAL_SIZE = 40;

    const seal = (
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{
          width: SEAL_SIZE,
          height: SEAL_SIZE,
          [isRight ? 'marginLeft' : 'marginRight']: -12,
          zIndex: 3,
        } as any}
      >
        {/* Vành răng cưa vàng (sun-burst) */}
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
              background: makeSealGradient(22),
            WebkitMask: 'radial-gradient(circle, #000 70%, transparent 72%)',
            mask: 'radial-gradient(circle, #000 70%, transparent 72%)',
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))',
          }}
        />
        {/* Vành vàng kim ngoài cùng (smooth) */}
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 4, borderRadius: '50%',
            background:
              'conic-gradient(from 90deg, #fef3c7, #fbbf24, #92400e, #fbbf24, #fde68a, #92400e, #fbbf24, #fef3c7)',
            boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.4)',
          }}
        />
        {/* Mặt huy chương — gradient cùng tone */}
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 6, borderRadius: '50%',
            background: `radial-gradient(circle at 32% 28%, ${tone.sealFrom} 0%, ${tone.sealTo} 85%)`,
            boxShadow:
              'inset 0 0 0 1px #fbbf24, inset 0 -2px 4px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.18)',
          }}
        />
        {/* Vòng chấm bi vàng */}
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 9, borderRadius: '50%',
            border: '0.7px dotted rgba(253,230,138,0.9)',
          }}
        />
        {/* Chữ cái serif vàng */}
        <span
          style={{
            position: 'relative', zIndex: 2,
            fontSize: 18, fontWeight: 700,
            color: '#fde68a',
            fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
            textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 0 5px rgba(251,191,36,0.5)',
            lineHeight: 1,
          }}
        >
          {sealLetter}
        </span>
      </div>
    );

    const ribbon = (
      <div
        style={{
          position: 'relative',
          background: `linear-gradient(135deg, ${tone.from} 0%, ${tone.to} 100%)`,
          color: '#ffffff',
          padding: subtitle
            ? (isRight ? '4px 12px 4px 18px' : '4px 18px 4px 12px')
            : (isRight ? '6px 14px 6px 20px' : '6px 20px 6px 14px'),
          borderRadius: 7,
          fontSize: subtitle ? 10 : 11.5,
          fontWeight: 800,
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1.1,
          textTransform: 'uppercase',
          textShadow: '0 1px 1.5px rgba(0,0,0,0.55)',
          fontFamily: '"Playfair Display", Georgia, serif',
          overflow: 'hidden',
          // 2 lớp viền vàng + glass highlight trên + bóng tối dưới
          boxShadow: [
            'inset 0 0 0 1px #fbbf24',
            'inset 0 0 0 2px rgba(146,64,14,0.55)',
            'inset 0 1px 0 rgba(255,255,255,0.28)',
            'inset 0 -3px 4px rgba(0,0,0,0.35)',
            '0 2px 4px rgba(0,0,0,0.25)',
          ].join(', '),
        }}
      >
        {/* Glass highlight phía trên */}
        <span
          aria-hidden
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)',
            pointerEvents: 'none',
          }}
        />
        {/* Shine sweep */}
        <span
          aria-hidden
          className="luxury-shine"
          style={{
            position: 'absolute', top: 0, bottom: 0, width: '40%',
            background: 'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
            pointerEvents: 'none',
            transform: 'skewX(-20deg)',
          }}
        />
        <span style={{ position: 'relative', zIndex: 1 }}>{displayText}</span>
        {subtitle && (
          <span
            style={{
              position: 'relative', zIndex: 1,
              fontSize: 9, letterSpacing: '0.14em', fontWeight: 600,
              opacity: 0.95, marginTop: 1,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    );

    return (
      <div className="absolute z-10" style={getLuxuryCornerStyle(corner)}>
        <div
          className="flex items-center select-none"
          style={{
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))',
            flexDirection: isRight ? 'row-reverse' : 'row',
          }}
        >
          {seal}
          {ribbon}
        </div>
      </div>
    );
  };

  // === MODERN BADGE ===
  // Phong cách hiện đại 3D Ribbon: nhãn ribbon có góc gập (fold tail),
  // gradient bóng (highlight phía trên), chữ trắng in đậm với shadow,
  // đổ bóng mềm dưới ribbon — y như sticker 3D thương mại điện tử.
  const ModernBadge = ({ opt, corner }: { opt: typeof PRODUCT_BADGE_OPTIONS[0]; corner: Corner }) => {
    const [, highlight] = splitLabel(opt.id, opt.text);
    const baseColor = getBadgeGradient(opt);
    const shift = (hex: string, amt: number) => {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      const adj = (c: number) =>
        amt >= 0
          ? Math.min(255, Math.round(c + (255 - c) * amt))
          : Math.max(0, Math.round(c * (1 + amt)));
      const r = adj((n >> 16) & 255);
      const g = adj((n >> 8) & 255);
      const b = adj(n & 255);
      return `rgb(${r}, ${g}, ${b})`;
    };
    const lighter = shift(baseColor, 0.28);
    const darker = shift(baseColor, -0.28);
    const deeper = shift(baseColor, -0.5);
    // Gradient 3D: highlight trên cùng -> base -> tối dưới
    const gradient = `linear-gradient(180deg, ${lighter} 0%, ${baseColor} 45%, ${darker} 100%)`;
    const isRight = corner === 'tr' || corner === 'br';
    return (
      <div
        className={`absolute z-10 ${cornerClass(corner)}`}
        style={{
          top: corner === 'tl' || corner === 'tr' ? 8 : undefined,
          bottom: corner === 'bl' || corner === 'br' ? 8 : undefined,
          left: corner === 'tl' || corner === 'bl' ? 0 : undefined,
          right: corner === 'tr' || corner === 'br' ? 0 : undefined,
          filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.28))',
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block', transform: isRight ? 'scaleX(-1)' : 'none' }}>
          {/* Thân ribbon với góc cắt chéo (clip-path) */}
          <div
            style={{
              position: 'relative',
              padding: '5px 16px 5px 10px',
              background: gradient,
              clipPath: 'polygon(0 0, 100% 0, calc(100% - 10px) 50%, 100% 100%, 0 100%)',
              borderRadius: '4px 0 0 4px',
              minHeight: 22,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* Highlight bóng phía trên */}
            <span
              style={{
                position: 'absolute',
                top: 1,
                left: 4,
                right: 14,
                height: '38%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
                borderRadius: '4px 4px 50% 50% / 4px 4px 100% 100%',
                pointerEvents: 'none',
              }}
            />
            <span
              style={{
                position: 'relative',
                color: '#fff',
                fontSize: 11,
                fontWeight: 900,
                fontStyle: 'italic',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                lineHeight: 1,
                textShadow: '0 1px 2px rgba(0,0,0,0.35), 0 0 1px rgba(0,0,0,0.4)',
                transform: isRight ? 'scaleX(-1)' : 'none',
                display: 'inline-block',
              }}
            >
              {highlight}
            </span>
          </div>
          {/* Đuôi ribbon gập phía dưới (fold tail) */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: -5,
              width: 8,
              height: 6,
              background: deeper,
              clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
            }}
          />
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

  // === TIKTOK SHOP STYLE ===
  // Một dải băng nhiều màu nằm sát đáy ảnh, mỗi nhãn là 1 segment với
  // tiêu đề in hoa + dòng phụ nhỏ, các segment được "cắt răng cưa" gối lên nhau.
  if (badgeStyle === 'tiktok') {
    const tikItems = items.slice(0, 3) as typeof PRODUCT_BADGE_OPTIONS[number][];
    // Bộ màu mặc định kiểu TikTok Shop (teal → orange → yellow)
    const defaultPalette = ['#2dd4bf', '#fb923c', '#fbbf24'];
    return (
      <div
        className="absolute left-0 right-0 z-10 px-1 pointer-events-none"
        style={{ bottom: 6 }}
      >
        <div className="flex items-stretch w-fit max-w-full" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))' }}>
          {tikItems.map((opt, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === tikItems.length - 1;
            const baseColor = getBadgeGradient(opt) || defaultPalette[idx % defaultPalette.length];
            const [prefix, highlight] = splitLabel(opt.id, opt.text);
            // Cắt răng cưa: trái phẳng cho segment đầu, phải vát chéo (trừ segment cuối)
            const clip = isLast
              ? (isFirst
                  ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
                  : 'polygon(8px 0, 100% 0, 100% 100%, 0 100%)')
              : (isFirst
                  ? 'polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%)'
                  : 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)');
            return (
              <div
                key={opt.id}
                style={{
                  background: baseColor,
                  clipPath: clip,
                  marginLeft: isFirst ? 0 : -6,
                  padding: '3px 10px 3px 12px',
                  minWidth: 56,
                  borderTopLeftRadius: isFirst ? 6 : 0,
                  borderBottomLeftRadius: isFirst ? 6 : 0,
                  borderTopRightRadius: isLast ? 6 : 0,
                  borderBottomRightRadius: isLast ? 6 : 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1.05,
                }}
              >
                <span
                  style={{
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 1px rgba(0,0,0,0.18)',
                  }}
                >
                  {highlight}
                </span>
                {prefix && (
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: 8,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      opacity: 0.95,
                      marginTop: 1,
                    }}
                  >
                    {prefix}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {assignments.map(({ opt, corner, variant }) =>
        badgeStyle === 'luxury'
          ? <LuxuryBadge key={opt.id} opt={opt} corner={corner} />
          : badgeStyle === 'modern'
          ? <ModernBadge key={opt.id} opt={opt} corner={corner} />
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
        <div className="mt-2"><DiscountBadgesStack product={product as any} /></div>
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
          <RatingAndSoldLine product={product} />
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
        <DiscountBadgesStack product={product as any} />
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
          <RatingAndSoldLine product={product} />
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
        <DiscountBadgesStack product={product as any} />
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
          <RatingAndSoldLine product={product} />
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
        <DiscountBadgesStack product={product as any} />
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
          <RatingAndSoldLine product={product} />
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
        <DiscountBadgesStack product={product as any} align="center" />
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
          <RatingAndSoldLine product={product} />
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
        <div className="mt-1.5"><DiscountBadgesStack product={product as any} /></div>
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
          <RatingAndSoldLine product={product} />
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
        <DiscountBadgesStack product={product as any} />
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
          <RatingAndSoldLine product={product} />
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
        <div className="mt-1.5"><DiscountBadgesStack product={product as any} /></div>
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
          <RatingAndSoldLine product={product} />
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
