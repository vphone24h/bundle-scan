// Website template definitions for VKHO store builder
export interface WebsiteTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string; // emoji
  tier: 'basic' | 'premium' | 'pro';
  available: boolean;
  brandInspiration?: string; // e.g. "Apple Store VN"
}

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  // Technology
  { id: 'phone_store', name: 'Cửa hàng điện thoại (banner lớn, lưới sản phẩm, giá nổi bật)', category: 'Công nghệ', description: 'Phong cách Apple Store cao cấp, tối ưu bán iPhone/Samsung', icon: '📱', tier: 'premium', available: true },
  { id: 'laptop_store', name: 'Cửa hàng laptop (so sánh cấu hình, lọc theo CPU/RAM)', category: 'Công nghệ', description: 'Hiện đại, chuyên nghiệp cho máy tính', icon: '💻', tier: 'premium', available: true },
  { id: 'accessories_store', name: 'Phụ kiện công nghệ (lưới sản phẩm nhiều màu, giá rẻ)', category: 'Công nghệ', description: 'Trẻ trung, năng động', icon: '🎧', tier: 'basic', available: true },
  { id: 'electronics_store', name: 'Cửa hàng điện máy (danh mục đa ngành, khuyến mãi lớn)', category: 'Công nghệ', description: 'Chuyên nghiệp cho điện máy gia dụng', icon: '🔌', tier: 'basic', available: true },

  // Fashion & Beauty
  { id: 'fashion_store', name: 'Thời trang (lookbook, ảnh model lớn, lọc size/màu)', category: 'Thời trang & Làm đẹp', description: 'Phong cách Zara/Uniqlo sang trọng', icon: '👗', tier: 'premium', available: true },
  { id: 'shoes_store', name: 'Giày dép (ảnh sản phẩm 360°, chọn size nhanh)', category: 'Thời trang & Làm đẹp', description: 'Hiện đại, tập trung hình ảnh sản phẩm', icon: '👟', tier: 'basic', available: true },
  { id: 'cosmetics_store', name: 'Mỹ phẩm (banner nữ tính, review sản phẩm)', category: 'Thời trang & Làm đẹp', description: 'Sang trọng, nữ tính', icon: '💄', tier: 'premium', available: true },
  { id: 'spa_store', name: 'Spa / Thẩm mỹ viện (đặt lịch online, gói dịch vụ)', category: 'Thời trang & Làm đẹp', description: 'Thư giãn, sang trọng với đặt lịch nhanh', icon: '🧖', tier: 'premium', available: true },
  { id: 'salon_store', name: 'Salon tóc (gallery kiểu tóc, đặt lịch stylist)', category: 'Thời trang & Làm đẹp', description: 'Sáng tạo, hiện đại', icon: '💇', tier: 'basic', available: true },
  { id: 'watch_store', name: 'Đồng hồ (ảnh chi tiết, thương hiệu cao cấp)', category: 'Thời trang & Làm đẹp', description: 'Cao cấp, tinh tế', icon: '⌚', tier: 'premium', available: true },
  { id: 'jewelry_store', name: 'Trang sức (ảnh macro lấp lánh, bộ sưu tập)', category: 'Thời trang & Làm đẹp', description: 'Sang trọng, quý phái', icon: '💎', tier: 'pro', available: true },

  // Food & Beverage
  { id: 'restaurant_store', name: 'Nhà hàng (menu hình ảnh lớn, đặt bàn online)', category: 'Ẩm thực', description: 'Menu đẹp, hình ảnh món ăn lớn', icon: '🍽️', tier: 'premium', available: true },
  { id: 'cafe_store', name: 'Quán cafe (không gian ấm cúng, menu đồ uống)', category: 'Ẩm thực', description: 'Ấm cúng, nghệ thuật', icon: '☕', tier: 'basic', available: true },
  { id: 'boba_store', name: 'Trà sữa (menu màu sắc, topping nổi bật)', category: 'Ẩm thực', description: 'Trẻ trung, màu sắc tươi sáng', icon: '🧋', tier: 'basic', available: true },

  // Real Estate & Automotive
  { id: 'realestate_store', name: 'Bất động sản (lọc khu vực, bản đồ, ảnh nhà lớn)', category: 'BĐS & Xe', description: 'Chuyên nghiệp, tìm kiếm theo khu vực', icon: '🏠', tier: 'pro', available: true },
  { id: 'car_showroom', name: 'Showroom ô tô (ảnh xe full-screen, đăng ký lái thử)', category: 'BĐS & Xe', description: 'Cao cấp, lái thử, so sánh xe', icon: '🚗', tier: 'pro', available: true },
  { id: 'motorbike_showroom', name: 'Showroom xe máy (ảnh xe nổi bật, bảng giá xe)', category: 'BĐS & Xe', description: 'Năng động, trẻ trung', icon: '🏍️', tier: 'premium', available: true },

  // Home & Construction
  { id: 'furniture_store', name: 'Nội thất (ảnh không gian sống, theo phòng)', category: 'Nhà & Xây dựng', description: 'Tối giản, hình ảnh không gian sống', icon: '🛋️', tier: 'premium', available: true },
  { id: 'construction_store', name: 'Vật liệu xây dựng (báo giá nhanh, danh mục VLXD)', category: 'Nhà & Xây dựng', description: 'Chuyên nghiệp, báo giá nhanh', icon: '🧱', tier: 'basic', available: true },

  // Hospitality
  { id: 'hotel_store', name: 'Khách sạn / Homestay (đặt phòng, lịch trống, ảnh phòng)', category: 'Dịch vụ lưu trú', description: 'Sang trọng, đặt phòng trực tuyến', icon: '🏨', tier: 'pro', available: true },

  // Retail
  { id: 'minimart_store', name: 'Siêu thị mini (danh mục đa dạng, tìm kiếm nhanh)', category: 'Bán lẻ', description: 'Đa dạng sản phẩm, dễ tìm', icon: '🏪', tier: 'basic', available: true },
  { id: 'grocery_store', name: 'Cửa hàng tạp hóa (giao diện đơn giản, dễ đặt hàng)', category: 'Bán lẻ', description: 'Đơn giản, hiệu quả', icon: '🛒', tier: 'basic', available: true },
  { id: 'wholesale_store', name: 'Bán sỉ – đại lý (bảng giá sỉ, đặt số lượng lớn)', category: 'Bán lẻ', description: 'Bảng giá sỉ, đặt hàng nhanh', icon: '📦', tier: 'basic', available: true },
  { id: 'general_store', name: 'Bán hàng online tổng hợp (đa ngành, marketplace mini)', category: 'Bán lẻ', description: 'Đa ngành, marketplace mini', icon: '🛍️', tier: 'basic', available: true },

  // Services
  { id: 'repair_service', name: 'Dịch vụ sửa chữa (tra cứu đơn, báo giá nhanh)', category: 'Dịch vụ', description: 'Tra cứu đơn, báo giá', icon: '🔧', tier: 'basic', available: true },
  { id: 'training_center', name: 'Trung tâm đào tạo (danh sách khóa học, đăng ký online)', category: 'Dịch vụ', description: 'Khóa học, đăng ký online', icon: '🎓', tier: 'premium', available: true },
  { id: 'clinic_store', name: 'Phòng khám (đặt lịch khám, giới thiệu bác sĩ)', category: 'Dịch vụ', description: 'Tin cậy, đặt lịch khám', icon: '🏥', tier: 'premium', available: true },
  { id: 'pharmacy_store', name: 'Nhà thuốc (tìm thuốc nhanh, danh mục theo bệnh)', category: 'Dịch vụ', description: 'Tìm kiếm thuốc nhanh', icon: '💊', tier: 'basic', available: true },
  { id: 'company_site', name: 'Công ty / Doanh nghiệp (giới thiệu, dịch vụ, liên hệ)', category: 'Dịch vụ', description: 'Corporate, chuyên nghiệp', icon: '🏢', tier: 'premium', available: true },

  // Specialty
  { id: 'baby_store', name: 'Đồ mẹ và bé (màu pastel, lọc theo độ tuổi)', category: 'Chuyên biệt', description: 'Đáng yêu, an toàn', icon: '👶', tier: 'basic', available: true },
  { id: 'sports_store', name: 'Đồ thể thao (ảnh năng động, lọc môn thể thao)', category: 'Chuyên biệt', description: 'Năng động, mạnh mẽ', icon: '⚽', tier: 'basic', available: true },
  { id: 'pet_store', name: 'Thú cưng (ảnh cute, danh mục thức ăn/phụ kiện)', category: 'Chuyên biệt', description: 'Dễ thương, thân thiện', icon: '🐾', tier: 'basic', available: true },
  { id: 'farm_store', name: 'Nông sản / Đặc sản (nguồn gốc rõ ràng, ảnh thật)', category: 'Chuyên biệt', description: 'Tự nhiên, sạch, nguồn gốc rõ ràng', icon: '🌾', tier: 'basic', available: true },
  { id: 'landing_page', name: 'Landing Page bán hàng (1 trang dài, tối ưu chốt đơn)', category: 'Chuyên biệt', description: 'Trang đích tối ưu chuyển đổi', icon: '🎯', tier: 'basic', available: true },
  { id: 'bakery_store', name: 'Tiệm bánh (gallery bánh kem, đặt bánh sinh nhật)', category: 'Ẩm thực', description: 'Bánh kem nghệ thuật, 12 con giáp', icon: '🎂', tier: 'basic', available: true },
  { id: 'bar_store', name: 'Quán nhậu chill (tone gỗ tối, menu mồi nhậu & bia tháp)', category: 'Ẩm thực', description: 'Tone gỗ tối, vintage, menu mồi nhậu & bia tháp nổi bật ngay trang chủ', icon: '🍺', tier: 'premium', available: true, brandInspiration: 'Đề Pa Coffee – Quán nhậu chill' },

  // Dịch vụ sửa chữa chuyên biệt
  { id: 'vehicle_repair', name: 'Sửa xe (báo giá nhanh, đặt lịch sửa xe máy/ô tô)', category: 'Dịch vụ', description: 'Sửa xe máy, ô tô, báo giá nhanh', icon: '🏍️', tier: 'basic', available: true, brandInspiration: 'Garage chuyên nghiệp' },
  { id: 'hvac_repair', name: 'Sửa điện lạnh (đặt lịch sửa máy lạnh, tủ lạnh, máy giặt)', category: 'Dịch vụ', description: 'Sửa máy lạnh, tủ lạnh, máy giặt', icon: '❄️', tier: 'basic', available: true },
  { id: 'audio_store', name: 'Thiết bị âm thanh (loa, dàn karaoke, ảnh thiết bị lớn)', category: 'Công nghệ', description: 'Loa, dàn karaoke, âm thanh chuyên nghiệp', icon: '🔊', tier: 'premium', available: true, brandInspiration: 'Audio Pro Shop' },
  { id: 'karaoke_store', name: 'Karaoke / Phòng hát (đặt phòng online, bảng giá phòng)', category: 'Dịch vụ', description: 'Phòng hát, dàn karaoke, đặt phòng online', icon: '🎤', tier: 'premium', available: true, brandInspiration: 'Karaoke Box' },
  { id: 'massage_store', name: 'Massage / Xông hơi (gói dịch vụ, đặt lịch thư giãn)', category: 'Thời trang & Làm đẹp', description: 'Massage thư giãn, xông hơi, đặt lịch online', icon: '💆', tier: 'premium', available: true, brandInspiration: 'Luxury Spa & Massage' },

  // Apple Style Landing (cuối cùng)
  { id: 'apple_landing', name: 'Apple Style Landing (full-screen banner, tối giản cao cấp)', category: 'Công nghệ', description: 'Phong cách Apple.com – full-screen banners, tối giản, cao cấp', icon: '🍎', tier: 'pro', available: true, brandInspiration: 'Apple.com' },

  // Bảng giá list (nhập qua Tin tức – mỗi bài 1 bảng giá)
  { id: 'price_list', name: 'Bảng giá điện thoại (web 1 mặt show hết giá, phù hợp bán sỉ)', category: 'Công nghệ', description: '1 trang chủ duy nhất: banner + địa chỉ/SĐT + bảng giá list theo nhóm. Nội dung bảng giá biên tập trong mục Tin tức.', icon: '📋', tier: 'premium', available: true, brandInspiration: 'taoquangsang' },
];

export const TEMPLATE_CATEGORIES = [...new Set(WEBSITE_TEMPLATES.map(t => t.category))];

export function getTemplateById(id: string): WebsiteTemplate | undefined {
  return WEBSITE_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: string): WebsiteTemplate[] {
  return WEBSITE_TEMPLATES.filter(t => t.category === category);
}
