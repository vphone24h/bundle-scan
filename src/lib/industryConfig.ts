// Industry-specific configurations for website templates
// Each config provides default banner, trust badges, section labels, and accent colors

export interface IndustryTrustBadge {
  icon: string; // lucide icon name
  title: string;
  desc: string;
}

export interface NavItemConfig {
  id: string;
  label: string;
  enabled: boolean;
  type: 'page' | 'link'; // page = internal pageView, link = external URL
  pageView?: string; // for page type: home, products, news, warranty, repair, tradein, installment, etc.
  url?: string; // for link type
  icon?: string; // emoji or lucide icon name
}

// System pages that auto-generate content (no URL needed)
export interface SystemPageDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: string;
}

export const SYSTEM_PAGES: SystemPageDef[] = [
  { id: 'home', label: 'Trang chủ', icon: '🏠', description: 'Trang chủ website', category: 'Mặc định' },
  { id: 'products', label: 'Sản phẩm', icon: '📦', description: 'Danh sách sản phẩm từ kho', category: 'Mặc định' },
  { id: 'news', label: 'Tin tức', icon: '📰', description: 'Bài viết, blog', category: 'Mặc định' },
  { id: 'warranty', label: 'Bảo hành', icon: '🛡️', description: 'Tra cứu bảo hành', category: 'Mặc định' },
  { id: 'repair', label: 'Sửa chữa', icon: '🔧', description: 'Dịch vụ sửa chữa, bảng giá, đặt lịch', category: 'Dịch vụ' },
  { id: 'tradein', label: 'Thu cũ đổi mới', icon: '🔄', description: 'Quy trình thu cũ, định giá', category: 'Dịch vụ' },
  { id: 'installment', label: 'Trả góp', icon: '💳', description: 'Hướng dẫn trả góp 0%', category: 'Dịch vụ' },
  { id: 'accessories', label: 'Phụ kiện', icon: '🎧', description: 'Phụ kiện chính hãng', category: 'Sản phẩm' },
  { id: 'compare', label: 'So sánh sản phẩm', icon: '⚖️', description: 'So sánh cấu hình, giá', category: 'Sản phẩm' },
  { id: 'pricelist', label: 'Bảng giá', icon: '💰', description: 'Bảng giá cập nhật', category: 'Dịch vụ' },
  { id: 'booking', label: 'Đặt lịch', icon: '📅', description: 'Đặt lịch hẹn online', category: 'Dịch vụ' },
  { id: 'branches', label: 'Chi nhánh', icon: '📍', description: 'Hệ thống chi nhánh', category: 'Thông tin' },
  { id: 'contact', label: 'Liên hệ', icon: '📞', description: 'Thông tin liên hệ', category: 'Thông tin' },
  { id: 'services', label: 'Dịch vụ', icon: '💆', description: 'Danh sách dịch vụ', category: 'Dịch vụ' },
  { id: 'rooms', label: 'Phòng', icon: '🛏️', description: 'Danh sách phòng', category: 'Sản phẩm' },
  { id: 'courses', label: 'Khóa học', icon: '📚', description: 'Danh sách khóa học', category: 'Sản phẩm' },
  { id: 'doctors', label: 'Bác sĩ', icon: '👨‍⚕️', description: 'Đội ngũ bác sĩ', category: 'Thông tin' },
  { id: 'collection', label: 'Bộ sưu tập', icon: '👗', description: 'Bộ sưu tập mới', category: 'Sản phẩm' },
  { id: 'promotion', label: 'Khuyến mãi', icon: '🏷️', description: 'Chương trình khuyến mãi', category: 'Sản phẩm' },
  { id: 'reviews', label: 'Đánh giá', icon: '⭐', description: 'Đánh giá khách hàng', category: 'Thông tin' },
];

export function getSystemPageById(id: string): SystemPageDef | undefined {
  return SYSTEM_PAGES.find(p => p.id === id);
}

export const SYSTEM_PAGE_IDS = new Set(SYSTEM_PAGES.map(p => p.id));

export interface IndustryConfig {
  id: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  heroGradient: string; // CSS gradient for default banner
  accentColor: string; // hex
  trustBadges: IndustryTrustBadge[];
  productSectionTitle: string;
  productSectionSubtitle: string;
  emptyProductText: string;
  navLabels: { home: string; products: string; news: string; warranty: string };
  stickyBarLabels: { chat: string; call: string };
  fontFamily: string;
  suggestedNavItems?: NavItemConfig[]; // Extra nav items suggested for this industry
}

export const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {
  // === TECHNOLOGY ===
  phone_store: {
    id: 'phone_store',
    heroTitle: 'iPhone 16 Pro Max',
    heroSubtitle: 'Siêu phẩm công nghệ. Giá tốt nhất thị trường.',
    heroCta: 'Mua ngay',
    heroGradient: 'linear-gradient(135deg, #000000 0%, #1d1d1f 100%)',
    accentColor: '#0071e3',
    trustBadges: [
      { icon: 'Shield', title: 'Bảo hành 12 tháng', desc: 'Chính hãng Apple' },
      { icon: 'Award', title: 'Hàng chính hãng', desc: '100% nguyên seal' },
      { icon: 'Truck', title: 'Giao nhanh 2h', desc: 'Nội thành HCM/HN' },
      { icon: 'CreditCard', title: 'Trả góp 0%', desc: 'Duyệt nhanh 15 phút' },
    ],
    productSectionTitle: 'Sản phẩm nổi bật',
    productSectionSubtitle: 'Được khách hàng yêu thích nhất',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Tin tức', warranty: 'Bảo hành' },
    stickyBarLabels: { chat: 'Chat Zalo', call: 'Gọi ngay' },
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
  },
  laptop_store: {
    id: 'laptop_store',
    heroTitle: 'MacBook Pro M4',
    heroSubtitle: 'Hiệu năng vượt trội. Thiết kế tinh tế.',
    heroCta: 'Khám phá ngay',
    heroGradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    accentColor: '#0071e3',
    trustBadges: [
      { icon: 'Shield', title: 'Bảo hành 24 tháng', desc: 'Chính hãng' },
      { icon: 'Award', title: 'Nguyên seal', desc: 'Full box 100%' },
      { icon: 'Truck', title: 'Ship toàn quốc', desc: 'Miễn phí nội thành' },
      { icon: 'CreditCard', title: 'Trả góp 0%', desc: 'Thủ tục nhanh' },
    ],
    productSectionTitle: 'Laptop bán chạy',
    productSectionSubtitle: 'Cấu hình mạnh – Giá hợp lý',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Tin tức', warranty: 'Bảo hành' },
    stickyBarLabels: { chat: 'Tư vấn ngay', call: 'Gọi mua' },
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
  },
  accessories_store: {
    id: 'accessories_store',
    heroTitle: 'Phụ kiện chính hãng',
    heroSubtitle: 'Nâng tầm trải nghiệm công nghệ của bạn.',
    heroCta: 'Mua ngay',
    heroGradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    accentColor: '#6366f1',
    trustBadges: [
      { icon: 'Shield', title: 'Chính hãng', desc: 'Cam kết 100%' },
      { icon: 'Award', title: 'Giá tốt nhất', desc: 'So sánh trước mua' },
      { icon: 'Truck', title: 'Giao nhanh', desc: '2h nội thành' },
      { icon: 'CreditCard', title: 'Đổi trả 30 ngày', desc: 'Miễn phí' },
    ],
    productSectionTitle: 'Phụ kiện hot',
    productSectionSubtitle: 'Trending hôm nay',
    emptyProductText: 'Chưa có phụ kiện nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Review', warranty: 'Bảo hành' },
    stickyBarLabels: { chat: 'Chat ngay', call: 'Gọi mua' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  electronics_store: {
    id: 'electronics_store',
    heroTitle: 'Điện máy chính hãng',
    heroSubtitle: 'Giá tốt nhất – Bảo hành dài hạn.',
    heroCta: 'Xem ưu đãi',
    heroGradient: 'linear-gradient(135deg, #1a1a2e 0%, #e94560 100%)',
    accentColor: '#e94560',
    trustBadges: [
      { icon: 'Shield', title: 'Bảo hành 24 tháng', desc: 'Tại nhà' },
      { icon: 'Award', title: 'Chính hãng', desc: 'Hóa đơn đầy đủ' },
      { icon: 'Truck', title: 'Lắp đặt miễn phí', desc: 'Nội thành' },
      { icon: 'CreditCard', title: 'Trả góp 0%', desc: 'Qua thẻ tín dụng' },
    ],
    productSectionTitle: 'Điện máy bán chạy',
    productSectionSubtitle: 'Giá ưu đãi mỗi ngày',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Tin tức', warranty: 'Bảo hành' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },

  // === FASHION & BEAUTY ===
  fashion_store: {
    id: 'fashion_store',
    heroTitle: 'Bộ sưu tập mới',
    heroSubtitle: 'Phong cách thời thượng – Chất lượng vượt trội.',
    heroCta: 'Khám phá ngay',
    heroGradient: 'linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 50%, #1a1a1a 100%)',
    accentColor: '#1a1a1a',
    trustBadges: [
      { icon: 'Award', title: 'Hàng chính hãng', desc: 'Cam kết 100%' },
      { icon: 'Truck', title: 'Miễn phí ship', desc: 'Đơn từ 500K' },
      { icon: 'Shield', title: 'Đổi trả 7 ngày', desc: 'Miễn phí' },
      { icon: 'CreditCard', title: 'Thanh toán an toàn', desc: 'Nhiều hình thức' },
    ],
    productSectionTitle: 'Hot trend',
    productSectionSubtitle: 'Xu hướng được yêu thích nhất',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Bộ sưu tập', news: 'Lookbook', warranty: 'Chính sách' },
    stickyBarLabels: { chat: 'Tư vấn size', call: 'Gọi mua' },
    fontFamily: '"Playfair Display", "Georgia", serif',
  },
  shoes_store: {
    id: 'shoes_store',
    heroTitle: 'Giày dép thời trang',
    heroSubtitle: 'Bước chân phong cách – Tự tin tỏa sáng.',
    heroCta: 'Mua ngay',
    heroGradient: 'linear-gradient(135deg, #1a1a1a 0%, #434343 100%)',
    accentColor: '#e63946',
    trustBadges: [
      { icon: 'Award', title: 'Auth 100%', desc: 'Cam kết chính hãng' },
      { icon: 'Truck', title: 'Ship COD', desc: 'Toàn quốc' },
      { icon: 'Shield', title: 'Đổi size miễn phí', desc: '7 ngày' },
      { icon: 'CreditCard', title: 'Giá tốt nhất', desc: 'So sánh trước mua' },
    ],
    productSectionTitle: 'Best seller',
    productSectionSubtitle: 'Bán chạy nhất tuần',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Review', warranty: 'Chính sách' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Gọi mua' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  cosmetics_store: {
    id: 'cosmetics_store',
    heroTitle: 'Mỹ phẩm chính hãng',
    heroSubtitle: 'Đẹp tự nhiên – Rạng rỡ mỗi ngày.',
    heroCta: 'Xem ngay',
    heroGradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ee9ca7 100%)',
    accentColor: '#d4577b',
    trustBadges: [
      { icon: 'Award', title: 'Auth 100%', desc: 'Nhập khẩu chính hãng' },
      { icon: 'Shield', title: 'An toàn da', desc: 'FDA approved' },
      { icon: 'Truck', title: 'Ship nhanh', desc: '2h nội thành' },
      { icon: 'CreditCard', title: 'Quà tặng kèm', desc: 'Mỗi đơn hàng' },
    ],
    productSectionTitle: 'Best seller',
    productSectionSubtitle: 'Sản phẩm được yêu thích nhất',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Beauty tips', warranty: 'Chính sách' },
    stickyBarLabels: { chat: 'Tư vấn da', call: 'Hotline' },
    fontFamily: '"Nunito Sans", system-ui, sans-serif',
  },
  spa_store: {
    id: 'spa_store',
    heroTitle: 'Thư giãn & Làm đẹp',
    heroSubtitle: 'Tận hưởng khoảnh khắc chăm sóc bản thân.',
    heroCta: 'Đặt lịch ngay',
    heroGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    accentColor: '#764ba2',
    trustBadges: [
      { icon: 'Award', title: 'Chuyên gia hàng đầu', desc: 'Tay nghề cao' },
      { icon: 'Shield', title: 'Cam kết an toàn', desc: 'Thiết bị nhập khẩu' },
      { icon: 'Clock', title: 'Đặt lịch linh hoạt', desc: 'Mở cửa 8h–21h' },
      { icon: 'Star', title: '5 sao', desc: 'Đánh giá trung bình' },
    ],
    productSectionTitle: 'Dịch vụ nổi bật',
    productSectionSubtitle: 'Được yêu thích nhất',
    emptyProductText: 'Chưa có dịch vụ nào',
    navLabels: { home: 'Trang chủ', products: 'Dịch vụ', news: 'Beauty tips', warranty: 'Chính sách' },
    stickyBarLabels: { chat: 'Đặt lịch', call: 'Gọi ngay' },
    fontFamily: '"Cormorant Garamond", "Georgia", serif',
  },
  salon_store: {
    id: 'salon_store',
    heroTitle: 'Salon tóc cao cấp',
    heroSubtitle: 'Phong cách mới – Tự tin hơn mỗi ngày.',
    heroCta: 'Đặt lịch',
    heroGradient: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
    accentColor: '#c9a96e',
    trustBadges: [
      { icon: 'Award', title: 'Stylist chuyên nghiệp', desc: '10+ năm kinh nghiệm' },
      { icon: 'Star', title: 'Sản phẩm cao cấp', desc: 'Nhập khẩu chính hãng' },
      { icon: 'Clock', title: 'Không cần chờ', desc: 'Đặt lịch trước' },
      { icon: 'Shield', title: 'Cam kết đẹp', desc: 'Làm lại miễn phí' },
    ],
    productSectionTitle: 'Dịch vụ nổi bật',
    productSectionSubtitle: 'Xu hướng tóc mới nhất',
    emptyProductText: 'Chưa có dịch vụ nào',
    navLabels: { home: 'Trang chủ', products: 'Dịch vụ', news: 'Xu hướng', warranty: 'Chính sách' },
    stickyBarLabels: { chat: 'Đặt lịch', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  watch_store: {
    id: 'watch_store',
    heroTitle: 'Đồng hồ chính hãng',
    heroSubtitle: 'Thời gian là xa xỉ – Phong cách là vĩnh cửu.',
    heroCta: 'Khám phá',
    heroGradient: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)',
    accentColor: '#c9a96e',
    trustBadges: [
      { icon: 'Award', title: 'Auth 100%', desc: 'Full box + thẻ' },
      { icon: 'Shield', title: 'BH quốc tế', desc: '2–5 năm' },
      { icon: 'Truck', title: 'Ship bảo hiểm', desc: 'An toàn tuyệt đối' },
      { icon: 'CreditCard', title: 'Trả góp 0%', desc: '6–12 tháng' },
    ],
    productSectionTitle: 'Đồng hồ nổi bật',
    productSectionSubtitle: 'Đẳng cấp & Tinh tế',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Bộ sưu tập', news: 'Tin tức', warranty: 'Bảo hành' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Hotline' },
    fontFamily: '"Playfair Display", "Georgia", serif',
  },
  jewelry_store: {
    id: 'jewelry_store',
    heroTitle: 'Trang sức cao cấp',
    heroSubtitle: 'Vẻ đẹp vĩnh cửu – Giá trị bền vững.',
    heroCta: 'Khám phá',
    heroGradient: 'linear-gradient(135deg, #1a1a1a 0%, #2d1f3d 50%, #1a1a1a 100%)',
    accentColor: '#d4af37',
    trustBadges: [
      { icon: 'Award', title: 'Chứng nhận GIA', desc: 'Kim cương thiên nhiên' },
      { icon: 'Shield', title: 'Bảo hành trọn đời', desc: 'Đánh bóng miễn phí' },
      { icon: 'Truck', title: 'Giao bảo mật', desc: 'Bảo hiểm 100%' },
      { icon: 'CreditCard', title: 'Trả góp 0%', desc: 'Không lãi suất' },
    ],
    productSectionTitle: 'Trang sức nổi bật',
    productSectionSubtitle: 'Bộ sưu tập mới nhất',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Bộ sưu tập', news: 'Tin tức', warranty: 'Bảo hành' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Hotline' },
    fontFamily: '"Playfair Display", "Georgia", serif',
  },

  // === FOOD & BEVERAGE ===
  restaurant_store: {
    id: 'restaurant_store',
    heroTitle: 'Ẩm thực tinh hoa',
    heroSubtitle: 'Hương vị đích thực – Trải nghiệm khó quên.',
    heroCta: 'Đặt bàn',
    heroGradient: 'linear-gradient(135deg, #1a0a00 0%, #8b4513 50%, #2d1810 100%)',
    accentColor: '#c0392b',
    trustBadges: [
      { icon: 'Award', title: 'Nguyên liệu tươi', desc: 'Nhập hàng ngày' },
      { icon: 'Star', title: '4.9 sao', desc: 'Google Reviews' },
      { icon: 'Clock', title: 'Phục vụ nhanh', desc: '15–20 phút' },
      { icon: 'CreditCard', title: 'Thanh toán đa dạng', desc: 'Thẻ/Ví điện tử' },
    ],
    productSectionTitle: 'Menu nổi bật',
    productSectionSubtitle: 'Món bán chạy nhất',
    emptyProductText: 'Menu đang được cập nhật',
    navLabels: { home: 'Trang chủ', products: 'Menu', news: 'Tin tức', warranty: 'Đặt bàn' },
    stickyBarLabels: { chat: 'Đặt bàn', call: 'Gọi ngay' },
    fontFamily: '"Playfair Display", "Georgia", serif',
  },
  cafe_store: {
    id: 'cafe_store',
    heroTitle: 'Quán cà phê',
    heroSubtitle: 'Hương cà phê – Không gian thư giãn.',
    heroCta: 'Xem menu',
    heroGradient: 'linear-gradient(135deg, #3c1810 0%, #6f4e37 50%, #2c1503 100%)',
    accentColor: '#6f4e37',
    trustBadges: [
      { icon: 'Award', title: 'Hạt cà phê chọn lọc', desc: 'Rang xay tại chỗ' },
      { icon: 'Star', title: 'Không gian đẹp', desc: 'Check-in thả ga' },
      { icon: 'Clock', title: 'Mở cửa 7h–22h', desc: 'Cả tuần' },
      { icon: 'CreditCard', title: 'Free Wifi', desc: 'Tốc độ cao' },
    ],
    productSectionTitle: 'Menu nổi bật',
    productSectionSubtitle: 'Thức uống được yêu thích',
    emptyProductText: 'Menu đang cập nhật',
    navLabels: { home: 'Trang chủ', products: 'Menu', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Đặt hàng', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  boba_store: {
    id: 'boba_store',
    heroTitle: 'Trà sữa tươi ngon',
    heroSubtitle: 'Mát lạnh – Ngọt ngào – Đủ topping!',
    heroCta: 'Order ngay',
    heroGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fdfbfb 100%)',
    accentColor: '#e91e8c',
    trustBadges: [
      { icon: 'Award', title: 'Nguyên liệu tươi', desc: 'Không hóa chất' },
      { icon: 'Truck', title: 'Giao nhanh 15p', desc: 'Bán kính 5km' },
      { icon: 'Star', title: 'Topping đầy đủ', desc: 'Tự chọn' },
      { icon: 'CreditCard', title: 'Combo tiết kiệm', desc: 'Giảm 20%' },
    ],
    productSectionTitle: 'Best seller',
    productSectionSubtitle: 'Trà sữa bán chạy nhất',
    emptyProductText: 'Menu đang cập nhật',
    navLabels: { home: 'Trang chủ', products: 'Menu', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Order', call: 'Gọi ngay' },
    fontFamily: '"Nunito Sans", system-ui, sans-serif',
  },

  // === REAL ESTATE & AUTO ===
  realestate_store: {
    id: 'realestate_store',
    heroTitle: 'Bất động sản',
    heroSubtitle: 'Tìm ngôi nhà mơ ước của bạn.',
    heroCta: 'Xem dự án',
    heroGradient: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
    accentColor: '#2c5364',
    trustBadges: [
      { icon: 'Award', title: 'Pháp lý rõ ràng', desc: 'Sổ hồng riêng' },
      { icon: 'Shield', title: 'Tư vấn miễn phí', desc: 'Chuyên gia hàng đầu' },
      { icon: 'CreditCard', title: 'Hỗ trợ vay', desc: 'Lãi suất ưu đãi' },
      { icon: 'Star', title: 'Vị trí đắc địa', desc: 'Tiện ích đầy đủ' },
    ],
    productSectionTitle: 'Dự án nổi bật',
    productSectionSubtitle: 'Cơ hội đầu tư hấp dẫn',
    emptyProductText: 'Chưa có dự án nào',
    navLabels: { home: 'Trang chủ', products: 'Dự án', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Hotline' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  car_showroom: {
    id: 'car_showroom',
    heroTitle: 'Showroom ô tô',
    heroSubtitle: 'Đẳng cấp – Sang trọng – An toàn.',
    heroCta: 'Đặt lịch lái thử',
    heroGradient: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #0c0c0c 100%)',
    accentColor: '#c0392b',
    trustBadges: [
      { icon: 'Award', title: 'Xe chính hãng', desc: 'Đại lý ủy quyền' },
      { icon: 'Shield', title: 'Bảo hành 5 năm', desc: 'Không giới hạn km' },
      { icon: 'CreditCard', title: 'Trả góp 80%', desc: 'Lãi suất thấp' },
      { icon: 'Truck', title: 'Giao xe tận nơi', desc: 'Toàn quốc' },
    ],
    productSectionTitle: 'Xe nổi bật',
    productSectionSubtitle: 'Mẫu xe mới nhất',
    emptyProductText: 'Chưa có xe nào',
    navLabels: { home: 'Trang chủ', products: 'Xe', news: 'Tin tức', warranty: 'Bảo hành' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Hotline' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  motorbike_showroom: {
    id: 'motorbike_showroom',
    heroTitle: 'Showroom xe máy',
    heroSubtitle: 'Năng động – Mạnh mẽ – Tiết kiệm.',
    heroCta: 'Xem xe',
    heroGradient: 'linear-gradient(135deg, #1a1a2e 0%, #e94560 100%)',
    accentColor: '#e94560',
    trustBadges: [
      { icon: 'Award', title: 'Chính hãng', desc: 'Đại lý cấp 1' },
      { icon: 'Shield', title: 'Bảo hành 3 năm', desc: 'Theo hãng' },
      { icon: 'CreditCard', title: 'Trả góp 0%', desc: '6–36 tháng' },
      { icon: 'Truck', title: 'Giao xe tận nhà', desc: 'Miễn phí' },
    ],
    productSectionTitle: 'Xe bán chạy',
    productSectionSubtitle: 'Mẫu xe hot nhất',
    emptyProductText: 'Chưa có xe nào',
    navLabels: { home: 'Trang chủ', products: 'Xe', news: 'Tin tức', warranty: 'Bảo hành' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },

  // === HOME & CONSTRUCTION ===
  furniture_store: {
    id: 'furniture_store',
    heroTitle: 'Nội thất cao cấp',
    heroSubtitle: 'Không gian sống – Phong cách riêng bạn.',
    heroCta: 'Khám phá',
    heroGradient: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
    accentColor: '#2c3e50',
    trustBadges: [
      { icon: 'Award', title: 'Chất lượng cao', desc: 'Nhập khẩu châu Âu' },
      { icon: 'Truck', title: 'Lắp đặt miễn phí', desc: 'Nội thành' },
      { icon: 'Shield', title: 'Bảo hành 5 năm', desc: 'Sửa chữa tận nhà' },
      { icon: 'CreditCard', title: 'Trả góp', desc: '0% lãi suất' },
    ],
    productSectionTitle: 'Sản phẩm nổi bật',
    productSectionSubtitle: 'Phong cách sống hiện đại',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Cảm hứng', warranty: 'Chính sách' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Hotline' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  construction_store: {
    id: 'construction_store',
    heroTitle: 'Vật liệu xây dựng',
    heroSubtitle: 'Chất lượng – Giá gốc – Giao nhanh.',
    heroCta: 'Báo giá ngay',
    heroGradient: 'linear-gradient(135deg, #434343 0%, #000000 100%)',
    accentColor: '#e67e22',
    trustBadges: [
      { icon: 'Award', title: 'Giá gốc', desc: 'Nhà phân phối cấp 1' },
      { icon: 'Truck', title: 'Giao tận công trình', desc: 'Miễn phí nội thành' },
      { icon: 'Shield', title: 'Chất lượng cao', desc: 'Tiêu chuẩn quốc gia' },
      { icon: 'CreditCard', title: 'Công nợ', desc: 'Cho nhà thầu' },
    ],
    productSectionTitle: 'Sản phẩm nổi bật',
    productSectionSubtitle: 'Vật liệu bán chạy nhất',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Báo giá', call: 'Hotline' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },

  // === HOSPITALITY ===
  hotel_store: {
    id: 'hotel_store',
    heroTitle: 'Nghỉ dưỡng tuyệt vời',
    heroSubtitle: 'Trải nghiệm lưu trú đẳng cấp.',
    heroCta: 'Đặt phòng',
    heroGradient: 'linear-gradient(135deg, #0f2027 0%, #2c5364 100%)',
    accentColor: '#2c5364',
    trustBadges: [
      { icon: 'Star', title: '5 sao', desc: 'Đánh giá cao' },
      { icon: 'Award', title: 'View đẹp', desc: 'Tầm nhìn panorama' },
      { icon: 'Clock', title: 'Check-in 24/7', desc: 'Linh hoạt' },
      { icon: 'Shield', title: 'An ninh', desc: 'Camera 24/24' },
    ],
    productSectionTitle: 'Phòng nổi bật',
    productSectionSubtitle: 'Lựa chọn hoàn hảo cho bạn',
    emptyProductText: 'Chưa có phòng nào',
    navLabels: { home: 'Trang chủ', products: 'Phòng', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Đặt phòng', call: 'Hotline' },
    fontFamily: '"Playfair Display", "Georgia", serif',
  },

  // === RETAIL ===
  minimart_store: {
    id: 'minimart_store',
    heroTitle: 'Siêu thị tiện lợi',
    heroSubtitle: 'Mua sắm nhanh – Giá tốt mỗi ngày.',
    heroCta: 'Xem ưu đãi',
    heroGradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    accentColor: '#11998e',
    trustBadges: [
      { icon: 'Award', title: 'Giá tốt nhất', desc: 'Cam kết hoàn tiền' },
      { icon: 'Truck', title: 'Giao nhanh', desc: '30 phút' },
      { icon: 'Shield', title: 'Hàng chính hãng', desc: 'Date mới nhất' },
      { icon: 'CreditCard', title: 'Thanh toán tiện lợi', desc: 'Ví/Thẻ/COD' },
    ],
    productSectionTitle: 'Sản phẩm nổi bật',
    productSectionSubtitle: 'Ưu đãi hôm nay',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Ưu đãi', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Đặt hàng', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  grocery_store: {
    id: 'grocery_store',
    heroTitle: 'Tạp hóa tiện lợi',
    heroSubtitle: 'Đa dạng – Giá rẻ – Gần nhà bạn.',
    heroCta: 'Mua sắm',
    heroGradient: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
    accentColor: '#e67e22',
    trustBadges: [
      { icon: 'Award', title: 'Giá rẻ nhất', desc: 'Khu vực' },
      { icon: 'Truck', title: 'Giao tận nhà', desc: '500m quanh đây' },
      { icon: 'Shield', title: 'Hàng mới', desc: 'Nhập hàng ngày' },
      { icon: 'Clock', title: 'Mở 6h–22h', desc: 'Cả tuần' },
    ],
    productSectionTitle: 'Sản phẩm',
    productSectionSubtitle: 'Hàng mới về',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Khuyến mãi', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Đặt hàng', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  wholesale_store: {
    id: 'wholesale_store',
    heroTitle: 'Bán sỉ giá gốc',
    heroSubtitle: 'Đại lý – Nhà phân phối – Giá tốt nhất.',
    heroCta: 'Xem bảng giá',
    heroGradient: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
    accentColor: '#2980b9',
    trustBadges: [
      { icon: 'Award', title: 'Giá sỉ tốt nhất', desc: 'Chiết khấu cao' },
      { icon: 'Truck', title: 'Ship toàn quốc', desc: 'Số lượng lớn' },
      { icon: 'Shield', title: 'Hàng chính hãng', desc: 'Hóa đơn đầy đủ' },
      { icon: 'CreditCard', title: 'Công nợ', desc: 'Cho đại lý' },
    ],
    productSectionTitle: 'Sản phẩm sỉ',
    productSectionSubtitle: 'Bảng giá cập nhật',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Báo giá', call: 'Hotline' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  general_store: {
    id: 'general_store',
    heroTitle: 'Mua sắm online',
    heroSubtitle: 'Đa dạng sản phẩm – Giá tốt nhất.',
    heroCta: 'Mua ngay',
    heroGradient: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
    accentColor: '#ff416c',
    trustBadges: [
      { icon: 'Award', title: 'Hàng chất lượng', desc: 'Cam kết 100%' },
      { icon: 'Truck', title: 'Ship toàn quốc', desc: 'COD miễn phí' },
      { icon: 'Shield', title: 'Đổi trả', desc: '7 ngày miễn phí' },
      { icon: 'CreditCard', title: 'Thanh toán', desc: 'Nhiều hình thức' },
    ],
    productSectionTitle: 'Sản phẩm nổi bật',
    productSectionSubtitle: 'Bán chạy nhất',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Chat ngay', call: 'Hotline' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },

  // === SERVICES ===
  repair_service: {
    id: 'repair_service',
    heroTitle: 'Sửa chữa chuyên nghiệp',
    heroSubtitle: 'Nhanh chóng – Uy tín – Bảo hành dài.',
    heroCta: 'Báo giá ngay',
    heroGradient: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)',
    accentColor: '#4ca1af',
    trustBadges: [
      { icon: 'Award', title: 'Thợ giỏi', desc: '10+ năm kinh nghiệm' },
      { icon: 'Shield', title: 'Bảo hành 6 tháng', desc: 'Sau sửa chữa' },
      { icon: 'Clock', title: 'Sửa nhanh', desc: '30 phút – 1 giờ' },
      { icon: 'CreditCard', title: 'Báo giá trước', desc: 'Không phát sinh' },
    ],
    productSectionTitle: 'Dịch vụ nổi bật',
    productSectionSubtitle: 'Sửa chữa phổ biến nhất',
    emptyProductText: 'Chưa có dịch vụ nào',
    navLabels: { home: 'Trang chủ', products: 'Dịch vụ', news: 'Tin tức', warranty: 'Tra cứu' },
    stickyBarLabels: { chat: 'Báo giá', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  training_center: {
    id: 'training_center',
    heroTitle: 'Đào tạo chuyên nghiệp',
    heroSubtitle: 'Nâng cao kỹ năng – Đổi mới sự nghiệp.',
    heroCta: 'Đăng ký ngay',
    heroGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    accentColor: '#667eea',
    trustBadges: [
      { icon: 'Award', title: 'Giảng viên giỏi', desc: 'Thực chiến' },
      { icon: 'Star', title: 'Chứng chỉ', desc: 'Có giá trị' },
      { icon: 'Clock', title: 'Linh hoạt', desc: 'Online/Offline' },
      { icon: 'Shield', title: 'Cam kết đầu ra', desc: 'Việc làm' },
    ],
    productSectionTitle: 'Khóa học nổi bật',
    productSectionSubtitle: 'Đăng ký nhiều nhất',
    emptyProductText: 'Chưa có khóa học nào',
    navLabels: { home: 'Trang chủ', products: 'Khóa học', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  clinic_store: {
    id: 'clinic_store',
    heroTitle: 'Phòng khám uy tín',
    heroSubtitle: 'Sức khỏe của bạn – Sứ mệnh của chúng tôi.',
    heroCta: 'Đặt lịch khám',
    heroGradient: 'linear-gradient(135deg, #0f4c75 0%, #3282b8 100%)',
    accentColor: '#0f4c75',
    trustBadges: [
      { icon: 'Award', title: 'Bác sĩ chuyên khoa', desc: 'Giàu kinh nghiệm' },
      { icon: 'Shield', title: 'Trang thiết bị hiện đại', desc: 'Nhập khẩu' },
      { icon: 'Clock', title: 'Khám nhanh', desc: 'Không chờ đợi' },
      { icon: 'Star', title: 'Bảo mật thông tin', desc: '100% an toàn' },
    ],
    productSectionTitle: 'Dịch vụ khám',
    productSectionSubtitle: 'Chuyên khoa phổ biến',
    emptyProductText: 'Chưa có dịch vụ nào',
    navLabels: { home: 'Trang chủ', products: 'Dịch vụ', news: 'Sức khỏe', warranty: 'Đặt lịch' },
    stickyBarLabels: { chat: 'Đặt lịch', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  pharmacy_store: {
    id: 'pharmacy_store',
    heroTitle: 'Nhà thuốc uy tín',
    heroSubtitle: 'Thuốc chính hãng – Tư vấn miễn phí.',
    heroCta: 'Tìm thuốc',
    heroGradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    accentColor: '#11998e',
    trustBadges: [
      { icon: 'Shield', title: 'Thuốc chính hãng', desc: 'Đầy đủ giấy phép' },
      { icon: 'Award', title: 'Dược sĩ tư vấn', desc: 'Miễn phí 24/7' },
      { icon: 'Truck', title: 'Giao nhanh', desc: '30 phút' },
      { icon: 'Clock', title: 'Mở 7h–22h', desc: 'Cả tuần' },
    ],
    productSectionTitle: 'Sản phẩm nổi bật',
    productSectionSubtitle: 'Thuốc & thực phẩm chức năng',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Sức khỏe', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  company_site: {
    id: 'company_site',
    heroTitle: 'Giải pháp doanh nghiệp',
    heroSubtitle: 'Chuyên nghiệp – Uy tín – Hiệu quả.',
    heroCta: 'Liên hệ ngay',
    heroGradient: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
    accentColor: '#2c3e50',
    trustBadges: [
      { icon: 'Award', title: '10+ năm', desc: 'Kinh nghiệm' },
      { icon: 'Star', title: '500+ khách hàng', desc: 'Tin tưởng' },
      { icon: 'Shield', title: 'Cam kết chất lượng', desc: 'ISO 9001' },
      { icon: 'Clock', title: 'Hỗ trợ 24/7', desc: 'Tận tâm' },
    ],
    productSectionTitle: 'Sản phẩm & Dịch vụ',
    productSectionSubtitle: 'Giải pháp toàn diện',
    emptyProductText: 'Chưa có sản phẩm/dịch vụ nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Hotline' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },

  // === SPECIALTY ===
  baby_store: {
    id: 'baby_store',
    heroTitle: 'Đồ mẹ và bé',
    heroSubtitle: 'An toàn – Chất lượng – Yêu thương.',
    heroCta: 'Mua ngay',
    heroGradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    accentColor: '#e91e63',
    trustBadges: [
      { icon: 'Shield', title: 'An toàn 100%', desc: 'Chứng nhận quốc tế' },
      { icon: 'Award', title: 'Hàng chính hãng', desc: 'Nhập khẩu' },
      { icon: 'Truck', title: 'Giao nhanh', desc: '2h nội thành' },
      { icon: 'CreditCard', title: 'Quà tặng kèm', desc: 'Mỗi đơn hàng' },
    ],
    productSectionTitle: 'Sản phẩm nổi bật',
    productSectionSubtitle: 'Được mẹ tin dùng',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Mẹ & Bé', warranty: 'Chính sách' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Gọi mua' },
    fontFamily: '"Nunito Sans", system-ui, sans-serif',
  },
  sports_store: {
    id: 'sports_store',
    heroTitle: 'Đồ thể thao',
    heroSubtitle: 'Năng động – Mạnh mẽ – Chiến thắng.',
    heroCta: 'Mua ngay',
    heroGradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    accentColor: '#e94560',
    trustBadges: [
      { icon: 'Award', title: 'Auth 100%', desc: 'Nike/Adidas/Puma' },
      { icon: 'Truck', title: 'Ship COD', desc: 'Toàn quốc' },
      { icon: 'Shield', title: 'Đổi trả', desc: '30 ngày' },
      { icon: 'CreditCard', title: 'Giá tốt', desc: 'So sánh trước mua' },
    ],
    productSectionTitle: 'Sản phẩm hot',
    productSectionSubtitle: 'Best seller',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Review', warranty: 'Chính sách' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Hotline' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  pet_store: {
    id: 'pet_store',
    heroTitle: 'Thú cưng yêu thương',
    heroSubtitle: 'Tất cả cho boss của bạn 🐾',
    heroCta: 'Mua ngay',
    heroGradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    accentColor: '#e67e22',
    trustBadges: [
      { icon: 'Shield', title: 'An toàn', desc: 'Sản phẩm kiểm định' },
      { icon: 'Award', title: 'Nhập khẩu', desc: 'Chính hãng' },
      { icon: 'Truck', title: 'Giao nhanh', desc: '1h nội thành' },
      { icon: 'Star', title: 'Tư vấn miễn phí', desc: 'Bác sĩ thú y' },
    ],
    productSectionTitle: 'Sản phẩm cho boss',
    productSectionSubtitle: 'Được yêu thích nhất',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Mẹo hay', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Tư vấn', call: 'Gọi ngay' },
    fontFamily: '"Nunito Sans", system-ui, sans-serif',
  },
  farm_store: {
    id: 'farm_store',
    heroTitle: 'Nông sản sạch',
    heroSubtitle: 'Từ nông trại đến bàn ăn – 100% tự nhiên.',
    heroCta: 'Đặt hàng',
    heroGradient: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
    accentColor: '#27ae60',
    trustBadges: [
      { icon: 'Award', title: 'Organic', desc: 'Chứng nhận VietGAP' },
      { icon: 'Shield', title: 'Nguồn gốc rõ ràng', desc: 'QR truy xuất' },
      { icon: 'Truck', title: 'Thu hoạch tươi', desc: 'Giao trong ngày' },
      { icon: 'Star', title: 'Không thuốc', desc: 'An toàn 100%' },
    ],
    productSectionTitle: 'Nông sản tươi',
    productSectionSubtitle: 'Thu hoạch hôm nay',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Câu chuyện', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Đặt hàng', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  landing_page: {
    id: 'landing_page',
    heroTitle: 'Sản phẩm nổi bật',
    heroSubtitle: 'Ưu đãi đặc biệt – Chỉ hôm nay.',
    heroCta: 'Mua ngay',
    heroGradient: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
    accentColor: '#ff416c',
    trustBadges: [
      { icon: 'Award', title: 'Chất lượng', desc: 'Cam kết 100%' },
      { icon: 'Truck', title: 'Miễn phí ship', desc: 'Toàn quốc' },
      { icon: 'Shield', title: 'Đổi trả', desc: '30 ngày' },
      { icon: 'Clock', title: 'Ưu đãi có hạn', desc: 'Đặt ngay!' },
    ],
    productSectionTitle: 'Sản phẩm',
    productSectionSubtitle: 'Ưu đãi đặc biệt',
    emptyProductText: 'Chưa có sản phẩm nào',
    navLabels: { home: 'Trang chủ', products: 'Sản phẩm', news: 'Tin tức', warranty: 'Liên hệ' },
    stickyBarLabels: { chat: 'Mua ngay', call: 'Gọi ngay' },
    fontFamily: '"Inter", system-ui, sans-serif',
  },
};

// Get config for a template, fallback to phone_store
export function getIndustryConfig(templateId: string): IndustryConfig {
  return INDUSTRY_CONFIGS[templateId] || INDUSTRY_CONFIGS.phone_store;
}

// Default nav items present for all templates
export function getDefaultNavItems(config: IndustryConfig): NavItemConfig[] {
  return [
    { id: 'home', label: config.navLabels.home, enabled: true, type: 'page', pageView: 'home', icon: '🏠' },
    { id: 'products', label: config.navLabels.products, enabled: true, type: 'page', pageView: 'products', icon: '📦' },
    { id: 'news', label: config.navLabels.news, enabled: true, type: 'page', pageView: 'news', icon: '📰' },
    { id: 'warranty', label: config.navLabels.warranty, enabled: true, type: 'page', pageView: 'warranty', icon: '🛡️' },
  ];
}

// Suggested extra nav items per industry - now using type: 'page' with pageView for system pages
export const INDUSTRY_SUGGESTED_NAV: Record<string, NavItemConfig[]> = {
  // Technology
  phone_store: [
    { id: 'repair', label: 'Sửa chữa', enabled: true, type: 'page', pageView: 'repair', icon: '🔧' },
    { id: 'tradein', label: 'Thu cũ đổi mới', enabled: true, type: 'page', pageView: 'tradein', icon: '🔄' },
    { id: 'installment', label: 'Trả góp', enabled: true, type: 'page', pageView: 'installment', icon: '💳' },
    { id: 'accessories', label: 'Phụ kiện', enabled: false, type: 'page', pageView: 'accessories', icon: '🎧' },
    { id: 'compare', label: 'So sánh máy', enabled: false, type: 'page', pageView: 'compare', icon: '⚖️' },
  ],
  laptop_store: [
    { id: 'repair', label: 'Sửa chữa', enabled: true, type: 'page', pageView: 'repair', icon: '🔧' },
    { id: 'tradein', label: 'Thu cũ đổi mới', enabled: true, type: 'page', pageView: 'tradein', icon: '🔄' },
    { id: 'installment', label: 'Trả góp', enabled: true, type: 'page', pageView: 'installment', icon: '💳' },
    { id: 'accessories', label: 'Phụ kiện', enabled: false, type: 'page', pageView: 'accessories', icon: '🎧' },
    { id: 'compare', label: 'So sánh máy', enabled: false, type: 'page', pageView: 'compare', icon: '⚖️' },
  ],
  accessories_store: [
    { id: 'combo', label: 'Combo tiết kiệm', enabled: true, type: 'page', pageView: 'promotion', icon: '🎁' },
    { id: 'guide', label: 'Hướng dẫn chọn', enabled: false, type: 'page', pageView: 'news', icon: '📖' },
  ],
  electronics_store: [
    { id: 'install', label: 'Lắp đặt', enabled: true, type: 'page', pageView: 'repair', icon: '🔧' },
    { id: 'installment', label: 'Trả góp', enabled: true, type: 'page', pageView: 'installment', icon: '💳' },
    { id: 'promotion', label: 'Khuyến mãi', enabled: true, type: 'page', pageView: 'promotion', icon: '🏷️' },
  ],
  // Fashion & Beauty
  fashion_store: [
    { id: 'collection', label: 'Bộ sưu tập', enabled: true, type: 'page', pageView: 'collection', icon: '👗' },
    { id: 'newarrival', label: 'Hàng mới về', enabled: true, type: 'page', pageView: 'products', icon: '✨' },
    { id: 'flashsale', label: 'Flash sale', enabled: true, type: 'page', pageView: 'promotion', icon: '⚡' },
    { id: 'lookbook', label: 'Lookbook', enabled: false, type: 'page', pageView: 'news', icon: '📸' },
    { id: 'sizeguide', label: 'Size guide', enabled: false, type: 'page', pageView: 'contact', icon: '📏' },
    { id: 'returnpolicy', label: 'Chính sách đổi trả', enabled: false, type: 'page', pageView: 'contact', icon: '🔄' },
  ],
  shoes_store: [
    { id: 'newarrival', label: 'Hàng mới về', enabled: true, type: 'page', pageView: 'products', icon: '✨' },
    { id: 'flashsale', label: 'Flash sale', enabled: true, type: 'page', pageView: 'promotion', icon: '⚡' },
    { id: 'sizeguide', label: 'Size guide', enabled: false, type: 'page', pageView: 'contact', icon: '📏' },
  ],
  cosmetics_store: [
    { id: 'skincare', label: 'Chăm sóc da', enabled: true, type: 'page', pageView: 'services', icon: '🧴' },
    { id: 'feedback', label: 'Feedback khách hàng', enabled: true, type: 'page', pageView: 'reviews', icon: '⭐' },
    { id: 'promotion', label: 'Khuyến mãi', enabled: true, type: 'page', pageView: 'promotion', icon: '🏷️' },
  ],
  spa_store: [
    { id: 'services', label: 'Dịch vụ', enabled: true, type: 'page', pageView: 'services', icon: '💆' },
    { id: 'pricelist', label: 'Bảng giá', enabled: true, type: 'page', pageView: 'pricelist', icon: '💰' },
    { id: 'booking', label: 'Đặt lịch', enabled: true, type: 'page', pageView: 'booking', icon: '📅' },
    { id: 'beforeafter', label: 'Trước & sau', enabled: true, type: 'page', pageView: 'reviews', icon: '📸' },
    { id: 'feedback', label: 'Feedback khách hàng', enabled: false, type: 'page', pageView: 'reviews', icon: '⭐' },
  ],
  salon_store: [
    { id: 'pricelist', label: 'Bảng giá', enabled: true, type: 'page', pageView: 'pricelist', icon: '💰' },
    { id: 'booking', label: 'Đặt lịch', enabled: true, type: 'page', pageView: 'booking', icon: '📅' },
    { id: 'trends', label: 'Xu hướng tóc', enabled: false, type: 'page', pageView: 'news', icon: '💇' },
  ],
  watch_store: [
    { id: 'collection', label: 'Bộ sưu tập', enabled: true, type: 'page', pageView: 'collection', icon: '⌚' },
    { id: 'installment', label: 'Trả góp', enabled: true, type: 'page', pageView: 'installment', icon: '💳' },
    { id: 'auth', label: 'Kiểm tra Auth', enabled: false, type: 'page', pageView: 'warranty', icon: '✅' },
  ],
  jewelry_store: [
    { id: 'collection', label: 'Bộ sưu tập', enabled: true, type: 'page', pageView: 'collection', icon: '💎' },
    { id: 'customorder', label: 'Đặt riêng', enabled: true, type: 'page', pageView: 'contact', icon: '✨' },
    { id: 'installment', label: 'Trả góp', enabled: false, type: 'page', pageView: 'installment', icon: '💳' },
  ],
  // Food & Beverage
  restaurant_store: [
    { id: 'booking', label: 'Đặt bàn', enabled: true, type: 'page', pageView: 'booking', icon: '🍽️' },
    { id: 'combo', label: 'Combo khuyến mãi', enabled: true, type: 'page', pageView: 'promotion', icon: '🎁' },
    { id: 'branches', label: 'Chi nhánh', enabled: true, type: 'page', pageView: 'branches', icon: '📍' },
    { id: 'delivery', label: 'Giao hàng', enabled: false, type: 'page', pageView: 'contact', icon: '🚚' },
    { id: 'reviews', label: 'Đánh giá', enabled: false, type: 'page', pageView: 'reviews', icon: '⭐' },
  ],
  cafe_store: [
    { id: 'combo', label: 'Combo khuyến mãi', enabled: true, type: 'page', pageView: 'promotion', icon: '🎁' },
    { id: 'branches', label: 'Chi nhánh', enabled: true, type: 'page', pageView: 'branches', icon: '📍' },
    { id: 'delivery', label: 'Giao hàng', enabled: false, type: 'page', pageView: 'contact', icon: '🚚' },
  ],
  boba_store: [
    { id: 'topping', label: 'Topping', enabled: true, type: 'page', pageView: 'products', icon: '🧋' },
    { id: 'combo', label: 'Combo tiết kiệm', enabled: true, type: 'page', pageView: 'promotion', icon: '🎁' },
    { id: 'delivery', label: 'Giao hàng', enabled: false, type: 'page', pageView: 'contact', icon: '🚚' },
  ],
  // Real Estate & Auto
  realestate_store: [
    { id: 'forsale', label: 'Nhà bán', enabled: true, type: 'page', pageView: 'products', icon: '🏠' },
    { id: 'forrent', label: 'Nhà cho thuê', enabled: true, type: 'page', pageView: 'products', icon: '🔑' },
    { id: 'investment', label: 'Tư vấn đầu tư', enabled: true, type: 'page', pageView: 'contact', icon: '📈' },
    { id: 'market', label: 'Tin thị trường', enabled: false, type: 'page', pageView: 'news', icon: '📊' },
  ],
  car_showroom: [
    { id: 'usedcar', label: 'Xe đã qua sử dụng', enabled: true, type: 'page', pageView: 'products', icon: '🚙' },
    { id: 'pricelist', label: 'Bảng giá', enabled: true, type: 'page', pageView: 'pricelist', icon: '💰' },
    { id: 'testdrive', label: 'Đặt lịch lái thử', enabled: true, type: 'page', pageView: 'booking', icon: '📅' },
    { id: 'compare', label: 'So sánh xe', enabled: false, type: 'page', pageView: 'compare', icon: '⚖️' },
    { id: 'promotion', label: 'Khuyến mãi', enabled: true, type: 'page', pageView: 'promotion', icon: '🏷️' },
  ],
  motorbike_showroom: [
    { id: 'usedmoto', label: 'Xe đã qua sử dụng', enabled: true, type: 'page', pageView: 'products', icon: '🏍️' },
    { id: 'pricelist', label: 'Bảng giá', enabled: true, type: 'page', pageView: 'pricelist', icon: '💰' },
    { id: 'installment', label: 'Trả góp', enabled: true, type: 'page', pageView: 'installment', icon: '💳' },
    { id: 'promotion', label: 'Khuyến mãi', enabled: true, type: 'page', pageView: 'promotion', icon: '🏷️' },
  ],
  // Home & Construction
  furniture_store: [
    { id: 'interior', label: 'Thiết kế nội thất', enabled: true, type: 'page', pageView: 'services', icon: '🏡' },
    { id: 'installment', label: 'Trả góp', enabled: false, type: 'page', pageView: 'installment', icon: '💳' },
  ],
  construction_store: [
    { id: 'quote', label: 'Báo giá', enabled: true, type: 'page', pageView: 'pricelist', icon: '💰' },
    { id: 'projects', label: 'Dự án', enabled: false, type: 'page', pageView: 'news', icon: '🏗️' },
  ],
  // Hospitality
  hotel_store: [
    { id: 'rooms', label: 'Phòng', enabled: true, type: 'page', pageView: 'rooms', icon: '🛏️' },
    { id: 'booking', label: 'Đặt phòng', enabled: true, type: 'page', pageView: 'booking', icon: '📅' },
    { id: 'pricelist', label: 'Bảng giá', enabled: true, type: 'page', pageView: 'pricelist', icon: '💰' },
    { id: 'amenities', label: 'Tiện ích', enabled: true, type: 'page', pageView: 'services', icon: '🏊' },
    { id: 'reviews', label: 'Đánh giá khách', enabled: false, type: 'page', pageView: 'reviews', icon: '⭐' },
    { id: 'attractions', label: 'Địa điểm du lịch', enabled: false, type: 'page', pageView: 'news', icon: '🗺️' },
  ],
  // Retail
  wholesale_store: [
    { id: 'wholesale', label: 'Sản phẩm sỉ', enabled: true, type: 'page', pageView: 'products', icon: '📦' },
    { id: 'agentpolicy', label: 'Chính sách đại lý', enabled: true, type: 'page', pageView: 'contact', icon: '📋' },
    { id: 'register', label: 'Đăng ký đại lý', enabled: true, type: 'page', pageView: 'contact', icon: '📝' },
    { id: 'pricelist', label: 'Bảng giá sỉ', enabled: true, type: 'page', pageView: 'pricelist', icon: '💰' },
  ],
  // Services
  training_center: [
    { id: 'courses', label: 'Khóa học', enabled: true, type: 'page', pageView: 'courses', icon: '📚' },
    { id: 'schedule', label: 'Lịch khai giảng', enabled: true, type: 'page', pageView: 'booking', icon: '📅' },
    { id: 'register', label: 'Đăng ký học', enabled: true, type: 'page', pageView: 'contact', icon: '📝' },
    { id: 'teachers', label: 'Giảng viên', enabled: false, type: 'page', pageView: 'doctors', icon: '👨‍🏫' },
    { id: 'fees', label: 'Học phí', enabled: false, type: 'page', pageView: 'pricelist', icon: '💰' },
    { id: 'certificate', label: 'Chứng chỉ', enabled: false, type: 'page', pageView: 'news', icon: '🎓' },
  ],
  clinic_store: [
    { id: 'doctors', label: 'Bác sĩ', enabled: true, type: 'page', pageView: 'doctors', icon: '👨‍⚕️' },
    { id: 'booking', label: 'Đặt lịch khám', enabled: true, type: 'page', pageView: 'booking', icon: '📅' },
    { id: 'pricelist', label: 'Bảng giá', enabled: true, type: 'page', pageView: 'pricelist', icon: '💰' },
    { id: 'faq', label: 'Hỏi đáp sức khỏe', enabled: false, type: 'page', pageView: 'news', icon: '❓' },
  ],
  pharmacy_store: [
    { id: 'consult', label: 'Tư vấn dược sĩ', enabled: true, type: 'page', pageView: 'contact', icon: '💊' },
  ],
};

// Get full nav items for a template (defaults + suggested extras)
export function getFullNavItems(templateId: string): NavItemConfig[] {
  const config = getIndustryConfig(templateId);
  const defaults = getDefaultNavItems(config);
  const extras = INDUSTRY_SUGGESTED_NAV[templateId] || [];
  return [...defaults, ...extras];
}

// Google Fonts import URLs for templates that need special fonts
export const GOOGLE_FONTS: Record<string, string> = {
  '"Playfair Display", "Georgia", serif': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
  '"Cormorant Garamond", "Georgia", serif': 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap',
  '"Nunito Sans", system-ui, sans-serif': 'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700&display=swap',
};
