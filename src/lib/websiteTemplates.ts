// Website template definitions for VKHO store builder
export interface WebsiteTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string; // emoji
  tier: 'basic' | 'premium' | 'pro';
  available: boolean;
}

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  // Technology
  { id: 'phone_store', name: 'Cửa hàng điện thoại', category: 'Công nghệ', description: 'Phong cách Apple Store cao cấp, tối ưu bán iPhone/Samsung', icon: '📱', tier: 'premium', available: true },
  { id: 'laptop_store', name: 'Cửa hàng laptop', category: 'Công nghệ', description: 'Hiện đại, chuyên nghiệp cho máy tính', icon: '💻', tier: 'premium', available: true },
  { id: 'accessories_store', name: 'Phụ kiện công nghệ', category: 'Công nghệ', description: 'Trẻ trung, năng động', icon: '🎧', tier: 'basic', available: true },
  { id: 'electronics_store', name: 'Cửa hàng điện máy', category: 'Công nghệ', description: 'Chuyên nghiệp cho điện máy gia dụng', icon: '🔌', tier: 'basic', available: true },

  // Fashion & Beauty
  { id: 'fashion_store', name: 'Thời trang', category: 'Thời trang & Làm đẹp', description: 'Phong cách Zara/Uniqlo sang trọng', icon: '👗', tier: 'premium', available: true },
  { id: 'shoes_store', name: 'Giày dép', category: 'Thời trang & Làm đẹp', description: 'Hiện đại, tập trung hình ảnh sản phẩm', icon: '👟', tier: 'basic', available: true },
  { id: 'cosmetics_store', name: 'Mỹ phẩm', category: 'Thời trang & Làm đẹp', description: 'Sang trọng, nữ tính', icon: '💄', tier: 'premium', available: true },
  { id: 'spa_store', name: 'Spa / Thẩm mỹ viện', category: 'Thời trang & Làm đẹp', description: 'Thư giãn, sang trọng với đặt lịch nhanh', icon: '🧖', tier: 'premium', available: true },
  { id: 'salon_store', name: 'Salon tóc', category: 'Thời trang & Làm đẹp', description: 'Sáng tạo, hiện đại', icon: '💇', tier: 'basic', available: true },
  { id: 'watch_store', name: 'Đồng hồ', category: 'Thời trang & Làm đẹp', description: 'Cao cấp, tinh tế', icon: '⌚', tier: 'premium', available: true },
  { id: 'jewelry_store', name: 'Trang sức', category: 'Thời trang & Làm đẹp', description: 'Sang trọng, quý phái', icon: '💎', tier: 'pro', available: true },

  // Food & Beverage
  { id: 'restaurant_store', name: 'Nhà hàng', category: 'Ẩm thực', description: 'Menu đẹp, hình ảnh món ăn lớn', icon: '🍽️', tier: 'premium', available: true },
  { id: 'cafe_store', name: 'Quán cafe', category: 'Ẩm thực', description: 'Ấm cúng, nghệ thuật', icon: '☕', tier: 'basic', available: true },
  { id: 'boba_store', name: 'Trà sữa', category: 'Ẩm thực', description: 'Trẻ trung, màu sắc tươi sáng', icon: '🧋', tier: 'basic', available: true },

  // Real Estate & Automotive
  { id: 'realestate_store', name: 'Bất động sản', category: 'BĐS & Xe', description: 'Chuyên nghiệp, tìm kiếm theo khu vực', icon: '🏠', tier: 'pro', available: true },
  { id: 'car_showroom', name: 'Showroom ô tô', category: 'BĐS & Xe', description: 'Cao cấp, lái thử, so sánh xe', icon: '🚗', tier: 'pro', available: true },
  { id: 'motorbike_showroom', name: 'Showroom xe máy', category: 'BĐS & Xe', description: 'Năng động, trẻ trung', icon: '🏍️', tier: 'premium', available: true },

  // Home & Construction
  { id: 'furniture_store', name: 'Nội thất', category: 'Nhà & Xây dựng', description: 'Tối giản, hình ảnh không gian sống', icon: '🛋️', tier: 'premium', available: true },
  { id: 'construction_store', name: 'Vật liệu xây dựng', category: 'Nhà & Xây dựng', description: 'Chuyên nghiệp, báo giá nhanh', icon: '🧱', tier: 'basic', available: true },

  // Hospitality
  { id: 'hotel_store', name: 'Khách sạn / Homestay', category: 'Dịch vụ lưu trú', description: 'Sang trọng, đặt phòng trực tuyến', icon: '🏨', tier: 'pro', available: true },

  // Retail
  { id: 'minimart_store', name: 'Siêu thị mini', category: 'Bán lẻ', description: 'Đa dạng sản phẩm, dễ tìm', icon: '🏪', tier: 'basic', available: true },
  { id: 'grocery_store', name: 'Cửa hàng tạp hóa', category: 'Bán lẻ', description: 'Đơn giản, hiệu quả', icon: '🛒', tier: 'basic', available: true },
  { id: 'wholesale_store', name: 'Bán sỉ (đại lý)', category: 'Bán lẻ', description: 'Bảng giá sỉ, đặt hàng nhanh', icon: '📦', tier: 'basic', available: true },
  { id: 'general_store', name: 'Bán hàng online tổng hợp', category: 'Bán lẻ', description: 'Đa ngành, marketplace mini', icon: '🛍️', tier: 'basic', available: true },

  // Services
  { id: 'repair_service', name: 'Dịch vụ sửa chữa', category: 'Dịch vụ', description: 'Tra cứu đơn, báo giá', icon: '🔧', tier: 'basic', available: true },
  { id: 'training_center', name: 'Trung tâm đào tạo', category: 'Dịch vụ', description: 'Khóa học, đăng ký online', icon: '🎓', tier: 'premium', available: true },
  { id: 'clinic_store', name: 'Phòng khám', category: 'Dịch vụ', description: 'Tin cậy, đặt lịch khám', icon: '🏥', tier: 'premium', available: true },
  { id: 'pharmacy_store', name: 'Nhà thuốc', category: 'Dịch vụ', description: 'Tìm kiếm thuốc nhanh', icon: '💊', tier: 'basic', available: true },
  { id: 'company_site', name: 'Công ty / Doanh nghiệp', category: 'Dịch vụ', description: 'Corporate, chuyên nghiệp', icon: '🏢', tier: 'premium', available: true },

  // Specialty
  { id: 'baby_store', name: 'Đồ mẹ và bé', category: 'Chuyên biệt', description: 'Đáng yêu, an toàn', icon: '👶', tier: 'basic', available: true },
  { id: 'sports_store', name: 'Đồ thể thao', category: 'Chuyên biệt', description: 'Năng động, mạnh mẽ', icon: '⚽', tier: 'basic', available: true },
  { id: 'pet_store', name: 'Thú cưng', category: 'Chuyên biệt', description: 'Dễ thương, thân thiện', icon: '🐾', tier: 'basic', available: true },
  { id: 'farm_store', name: 'Nông sản / Đặc sản', category: 'Chuyên biệt', description: 'Tự nhiên, sạch, nguồn gốc rõ ràng', icon: '🌾', tier: 'basic', available: true },
  { id: 'landing_page', name: 'Landing Page bán hàng', category: 'Chuyên biệt', description: 'Trang đích tối ưu chuyển đổi', icon: '🎯', tier: 'basic', available: true },
];

export const TEMPLATE_CATEGORIES = [...new Set(WEBSITE_TEMPLATES.map(t => t.category))];

export function getTemplateById(id: string): WebsiteTemplate | undefined {
  return WEBSITE_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: string): WebsiteTemplate[] {
  return WEBSITE_TEMPLATES.filter(t => t.category === category);
}
