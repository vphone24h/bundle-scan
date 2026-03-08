import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, ChevronDown, RotateCcw, Plus, Trash2, X, GripVertical } from 'lucide-react';
import { SYSTEM_PAGES } from '@/lib/industryConfig';

export interface ProductDetailSectionItem {
  id: string;
  enabled: boolean;
}

export interface CTAButtonItem {
  id: string;
  label: string;
  icon: string;
  action: string; // flexible action string
  enabled: boolean;
  customUrl?: string;
}

export interface CTAActionOption {
  value: string;
  label: string;
  defaultIcon: string;
  defaultLabel: string;
  category: string;
}

export const CTA_ACTION_OPTIONS: CTAActionOption[] = [
  // Mua sắm
  { value: 'order', label: 'Đặt mua / Mua ngay', defaultIcon: '🛒', defaultLabel: 'Mua ngay', category: 'Mua sắm' },
  { value: 'add_to_cart', label: 'Thêm vào giỏ hàng', defaultIcon: '🛒', defaultLabel: 'Thêm vào giỏ', category: 'Mua sắm' },
  { value: 'pre_order', label: 'Đặt trước', defaultIcon: '📋', defaultLabel: 'Đặt trước', category: 'Mua sắm' },
  { value: 'notify_stock', label: 'Báo khi có hàng', defaultIcon: '🔔', defaultLabel: 'Báo khi có hàng', category: 'Mua sắm' },
  { value: 'best_price', label: 'Xem giá tốt nhất', defaultIcon: '💰', defaultLabel: 'Giá tốt nhất', category: 'Mua sắm' },
  { value: 'get_quote', label: 'Nhận báo giá', defaultIcon: '📄', defaultLabel: 'Nhận báo giá', category: 'Mua sắm' },
  { value: 'compare', label: 'So sánh sản phẩm', defaultIcon: '⚖️', defaultLabel: 'So sánh', category: 'Mua sắm' },
  { value: 'view_detail', label: 'Xem chi tiết', defaultIcon: '🔍', defaultLabel: 'Xem chi tiết', category: 'Mua sắm' },
  { value: 'track_order', label: 'Tra cứu đơn hàng', defaultIcon: '📦', defaultLabel: 'Tra cứu đơn', category: 'Mua sắm' },

  // Tài chính
  { value: 'installment', label: 'Trả góp', defaultIcon: '💳', defaultLabel: 'Trả góp', category: 'Tài chính' },
  { value: 'installment_0', label: 'Trả góp 0%', defaultIcon: '💳', defaultLabel: 'Trả góp 0%', category: 'Tài chính' },

  // Tư vấn & Liên hệ
  { value: 'call', label: 'Gọi ngay', defaultIcon: '📞', defaultLabel: 'Gọi ngay', category: 'Tư vấn' },
  { value: 'consult_now', label: 'Tư vấn ngay', defaultIcon: '💬', defaultLabel: 'Tư vấn ngay', category: 'Tư vấn' },
  { value: 'zalo', label: 'Tư vấn Zalo', defaultIcon: '💬', defaultLabel: 'Tư vấn Zalo', category: 'Tư vấn' },
  { value: 'facebook', label: 'Chat Facebook', defaultIcon: '💬', defaultLabel: 'Chat Facebook', category: 'Tư vấn' },
  { value: 'support', label: 'Yêu cầu hỗ trợ', defaultIcon: '🛟', defaultLabel: 'Yêu cầu hỗ trợ', category: 'Tư vấn' },
  { value: 'send_request', label: 'Gửi yêu cầu', defaultIcon: '📩', defaultLabel: 'Gửi yêu cầu', category: 'Tư vấn' },

  // Đặt lịch
  { value: 'booking', label: 'Đặt lịch ngay', defaultIcon: '📅', defaultLabel: 'Đặt lịch ngay', category: 'Đặt lịch' },
  { value: 'booking_consult', label: 'Đặt lịch tư vấn', defaultIcon: '📅', defaultLabel: 'Đặt lịch tư vấn', category: 'Đặt lịch' },
  { value: 'booking_repair', label: 'Đặt lịch sửa chữa', defaultIcon: '🔧', defaultLabel: 'Đặt lịch sửa', category: 'Đặt lịch' },
  { value: 'booking_beauty', label: 'Đặt lịch làm đẹp', defaultIcon: '💅', defaultLabel: 'Đặt lịch làm đẹp', category: 'Đặt lịch' },
  { value: 'booking_clinic', label: 'Đặt lịch khám', defaultIcon: '🏥', defaultLabel: 'Đặt lịch khám', category: 'Đặt lịch' },
  { value: 'booking_store', label: 'Đặt lịch tại cửa hàng', defaultIcon: '🏪', defaultLabel: 'Đặt lịch tại CH', category: 'Đặt lịch' },

  // Ẩm thực
  { value: 'order_food', label: 'Đặt món ngay', defaultIcon: '🍽️', defaultLabel: 'Đặt món ngay', category: 'Ẩm thực' },
  { value: 'book_table', label: 'Đặt bàn', defaultIcon: '🪑', defaultLabel: 'Đặt bàn', category: 'Ẩm thực' },
  { value: 'delivery', label: 'Giao tận nơi', defaultIcon: '🚚', defaultLabel: 'Giao tận nơi', category: 'Ẩm thực' },
  { value: 'view_menu', label: 'Xem menu', defaultIcon: '📋', defaultLabel: 'Xem menu', category: 'Ẩm thực' },
  { value: 'book_party', label: 'Đặt tiệc', defaultIcon: '🎉', defaultLabel: 'Đặt tiệc', category: 'Ẩm thực' },

  // Ưu đãi & Khuyến mãi
  { value: 'get_offer', label: 'Nhận ưu đãi', defaultIcon: '🎁', defaultLabel: 'Nhận ưu đãi', category: 'Ưu đãi' },
  { value: 'get_coupon', label: 'Nhận mã giảm giá', defaultIcon: '🎫', defaultLabel: 'Nhận mã giảm giá', category: 'Ưu đãi' },
  { value: 'today_offer', label: 'Xem ưu đãi hôm nay', defaultIcon: '🔥', defaultLabel: 'Ưu đãi hôm nay', category: 'Ưu đãi' },
  { value: 'today_gift', label: 'Quà tặng hôm nay', defaultIcon: '🎁', defaultLabel: 'Quà tặng hôm nay', category: 'Ưu đãi' },
  { value: 'hot_deal', label: 'Xem deal hot', defaultIcon: '⚡', defaultLabel: 'Deal hot', category: 'Ưu đãi' },
  { value: 'join_member', label: 'Tham gia thành viên', defaultIcon: '👤', defaultLabel: 'Tham gia thành viên', category: 'Ưu đãi' },

  // Đánh giá & Bảo hành
  { value: 'view_reviews', label: 'Xem đánh giá', defaultIcon: '⭐', defaultLabel: 'Xem đánh giá', category: 'Đánh giá' },
  { value: 'write_review', label: 'Đánh giá sản phẩm', defaultIcon: '✍️', defaultLabel: 'Viết đánh giá', category: 'Đánh giá' },
  { value: 'check_warranty', label: 'Kiểm tra bảo hành', defaultIcon: '🛡️', defaultLabel: 'Kiểm tra bảo hành', category: 'Đánh giá' },

  // Khác
  { value: 'custom_link', label: 'Link tùy chỉnh', defaultIcon: '🔗', defaultLabel: 'Liên hệ', category: 'Khác' },
];

export function getDefaultCTAButtons(templateId?: string): CTAButtonItem[] {
  // Default CTA buttons per industry template - tối ưu theo ngành nghề
  // "Thêm vào giỏ hàng" là nút chính thay cho "Mua ngay" để khách có thể mua nhiều SP cùng lúc
  const INDUSTRY_CTA: Record<string, CTAButtonItem[]> = {
    // ===== CÔNG NGHỆ / ĐIỆN THOẠI / ĐIỆN MÁY =====
    // Thêm giỏ hàng + Trả góp + So sánh + Kiểm tra BH + Tư vấn
    phone_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_compare', label: 'So sánh sản phẩm', icon: '⚖️', action: 'compare', enabled: true },
      { id: 'cta_warranty', label: 'Kiểm tra bảo hành', icon: '🛡️', action: 'check_warranty', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    laptop_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_compare', label: 'So sánh sản phẩm', icon: '⚖️', action: 'compare', enabled: true },
      { id: 'cta_warranty', label: 'Kiểm tra bảo hành', icon: '🛡️', action: 'check_warranty', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    electronics_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_compare', label: 'So sánh sản phẩm', icon: '⚖️', action: 'compare', enabled: true },
      { id: 'cta_warranty', label: 'Kiểm tra bảo hành', icon: '🛡️', action: 'check_warranty', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    accessories_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_compare', label: 'So sánh sản phẩm', icon: '⚖️', action: 'compare', enabled: true },
      { id: 'cta_warranty', label: 'Kiểm tra bảo hành', icon: '🛡️', action: 'check_warranty', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    apple_landing: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_installment', label: 'Trả góp', icon: '💳', action: 'installment', enabled: true },
      { id: 'cta_compare', label: 'So sánh sản phẩm', icon: '⚖️', action: 'compare', enabled: true },
      { id: 'cta_warranty', label: 'Kiểm tra bảo hành', icon: '🛡️', action: 'check_warranty', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],

    // ===== THỜI TRANG / LÀM ĐẸP =====
    // Thêm giỏ hàng + Xem giỏ hàng + Nhận mã giảm giá + Tư vấn
    fashion_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_view_cart', label: 'Xem giỏ hàng', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_coupon', label: 'Nhận mã giảm giá', icon: '🎫', action: 'get_coupon', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    shoes_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_view_cart', label: 'Xem giỏ hàng', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_coupon', label: 'Nhận mã giảm giá', icon: '🎫', action: 'get_coupon', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    cosmetics_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_view_cart', label: 'Xem giỏ hàng', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_coupon', label: 'Nhận mã giảm giá', icon: '🎫', action: 'get_coupon', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    watch_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_view_cart', label: 'Xem giỏ hàng', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_coupon', label: 'Nhận mã giảm giá', icon: '🎫', action: 'get_coupon', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    jewelry_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_view_cart', label: 'Xem giỏ hàng', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_coupon', label: 'Nhận mã giảm giá', icon: '🎫', action: 'get_coupon', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],

    // ===== SPA / SALON =====
    // Đặt lịch làm đẹp + Tư vấn + Nhận ưu đãi + Tham gia thành viên
    spa_store: [
      { id: 'cta_booking', label: 'Đặt lịch làm đẹp', icon: '💅', action: 'booking_beauty', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
      { id: 'cta_offer', label: 'Nhận ưu đãi', icon: '🎁', action: 'get_offer', enabled: true },
      { id: 'cta_member', label: 'Tham gia thành viên', icon: '👤', action: 'join_member', enabled: true },
    ],
    salon_store: [
      { id: 'cta_booking', label: 'Đặt lịch làm đẹp', icon: '💅', action: 'booking_beauty', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
      { id: 'cta_offer', label: 'Nhận ưu đãi', icon: '🎁', action: 'get_offer', enabled: true },
      { id: 'cta_member', label: 'Tham gia thành viên', icon: '👤', action: 'join_member', enabled: true },
    ],

    // ===== ẨM THỰC / NHÀ HÀNG =====
    // Đặt món ngay + Đặt bàn + Đặt tiệc + Giao tận nơi
    restaurant_store: [
      { id: 'cta_food', label: 'Đặt món ngay', icon: '🍽️', action: 'order_food', enabled: true },
      { id: 'cta_table', label: 'Đặt bàn', icon: '🪑', action: 'book_table', enabled: true },
      { id: 'cta_party', label: 'Đặt tiệc', icon: '🎉', action: 'book_party', enabled: true },
      { id: 'cta_delivery', label: 'Giao tận nơi', icon: '🚚', action: 'delivery', enabled: true },
    ],
    cafe_store: [
      { id: 'cta_food', label: 'Đặt món ngay', icon: '🍽️', action: 'order_food', enabled: true },
      { id: 'cta_table', label: 'Đặt bàn', icon: '🪑', action: 'book_table', enabled: true },
      { id: 'cta_party', label: 'Đặt tiệc', icon: '🎉', action: 'book_party', enabled: true },
      { id: 'cta_delivery', label: 'Giao tận nơi', icon: '🚚', action: 'delivery', enabled: true },
    ],
    boba_store: [
      { id: 'cta_food', label: 'Đặt món ngay', icon: '🍽️', action: 'order_food', enabled: true },
      { id: 'cta_table', label: 'Đặt bàn', icon: '🪑', action: 'book_table', enabled: true },
      { id: 'cta_party', label: 'Đặt tiệc', icon: '🎉', action: 'book_party', enabled: true },
      { id: 'cta_delivery', label: 'Giao tận nơi', icon: '🚚', action: 'delivery', enabled: true },
    ],

    // ===== BẤT ĐỘNG SẢN / Ô TÔ =====
    // Đặt lịch xem + Nhận báo giá + Tư vấn
    realestate_store: [
      { id: 'cta_booking', label: 'Đặt lịch xem', icon: '📅', action: 'booking_consult', enabled: true },
      { id: 'cta_quote', label: 'Nhận báo giá', icon: '📄', action: 'get_quote', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    car_showroom: [
      { id: 'cta_booking', label: 'Đặt lịch xem', icon: '📅', action: 'booking_store', enabled: true },
      { id: 'cta_quote', label: 'Nhận báo giá', icon: '📄', action: 'get_quote', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
    motorbike_showroom: [
      { id: 'cta_booking', label: 'Đặt lịch xem', icon: '📅', action: 'booking_store', enabled: true },
      { id: 'cta_quote', label: 'Nhận báo giá', icon: '📄', action: 'get_quote', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],

    // ===== NỘI THẤT / XÂY DỰNG =====
    // Nhận báo giá + Gửi yêu cầu + Đặt lịch tư vấn
    furniture_store: [
      { id: 'cta_quote', label: 'Nhận báo giá', icon: '📄', action: 'get_quote', enabled: true },
      { id: 'cta_request', label: 'Gửi yêu cầu', icon: '📩', action: 'send_request', enabled: true },
      { id: 'cta_booking', label: 'Đặt lịch tư vấn', icon: '📅', action: 'booking_consult', enabled: true },
    ],
    construction_store: [
      { id: 'cta_quote', label: 'Nhận báo giá', icon: '📄', action: 'get_quote', enabled: true },
      { id: 'cta_request', label: 'Gửi yêu cầu', icon: '📩', action: 'send_request', enabled: true },
      { id: 'cta_booking', label: 'Đặt lịch tư vấn', icon: '📅', action: 'booking_consult', enabled: true },
    ],

    // ===== KHÁCH SẠN / HOMESTAY =====
    // Đặt phòng + Giá tốt nhất + Xem ưu đãi
    hotel_store: [
      { id: 'cta_booking', label: 'Đặt phòng', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_best', label: 'Giá tốt nhất', icon: '💰', action: 'best_price', enabled: true },
      { id: 'cta_offer', label: 'Xem ưu đãi', icon: '🎁', action: 'get_offer', enabled: true },
    ],

    // ===== SỬA CHỮA / KỸ THUẬT =====
    // Đặt lịch sửa chữa + Nhận báo giá + Tra cứu đơn + Kiểm tra BH
    repair_service: [
      { id: 'cta_booking', label: 'Đặt lịch sửa chữa', icon: '🔧', action: 'booking_repair', enabled: true },
      { id: 'cta_quote', label: 'Nhận báo giá', icon: '📄', action: 'get_quote', enabled: true },
      { id: 'cta_track', label: 'Tra cứu đơn', icon: '📦', action: 'track_order', enabled: true },
      { id: 'cta_warranty', label: 'Kiểm tra bảo hành', icon: '🛡️', action: 'check_warranty', enabled: true },
    ],

    // ===== Y TẾ / NHÀ THUỐC =====
    // Đặt lịch khám + Tư vấn dược sĩ
    clinic_store: [
      { id: 'cta_booking', label: 'Đặt lịch khám', icon: '🏥', action: 'booking_clinic', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn dược sĩ', icon: '💬', action: 'consult_now', enabled: true },
    ],
    pharmacy_store: [
      { id: 'cta_booking', label: 'Đặt lịch khám', icon: '🏥', action: 'booking_clinic', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn dược sĩ', icon: '💬', action: 'consult_now', enabled: true },
    ],

    // ===== ĐÀO TẠO / GIÁO DỤC =====
    // Đăng ký khóa học + Tư vấn
    training_center: [
      { id: 'cta_booking', label: 'Đăng ký khóa học', icon: '📅', action: 'booking', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],

    // ===== DOANH NGHIỆP / DỊCH VỤ =====
    // Gửi yêu cầu + Đặt lịch tư vấn + Nhận báo giá
    company_site: [
      { id: 'cta_request', label: 'Gửi yêu cầu', icon: '📩', action: 'send_request', enabled: true },
      { id: 'cta_booking', label: 'Đặt lịch tư vấn', icon: '📅', action: 'booking_consult', enabled: true },
      { id: 'cta_quote', label: 'Nhận báo giá', icon: '📄', action: 'get_quote', enabled: true },
    ],

    // ===== ĐẶC THÙ =====
    pet_store: [
      { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
      { id: 'cta_view_cart', label: 'Xem giỏ hàng', icon: '🛒', action: 'order', enabled: true },
      { id: 'cta_coupon', label: 'Nhận mã giảm giá', icon: '🎫', action: 'get_coupon', enabled: true },
      { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    ],
  };

  if (templateId && INDUSTRY_CTA[templateId]) {
    return INDUSTRY_CTA[templateId];
  }

  // Fallback mặc định cho ngành bán lẻ chung
  return [
    { id: 'cta_cart', label: 'Thêm vào giỏ hàng', icon: '🛒', action: 'add_to_cart', enabled: true },
    { id: 'cta_view_cart', label: 'Xem giỏ hàng', icon: '🛒', action: 'order', enabled: true },
    { id: 'cta_consult', label: 'Tư vấn', icon: '💬', action: 'consult_now', enabled: true },
    { id: 'cta_call', label: 'Gọi', icon: '📞', action: 'call', enabled: true },
  ];
}

const ALL_DETAIL_SECTIONS: { id: string; label: string; icon: string; description: string }[] = [
  { id: 'installment', label: 'Nút trả góp', icon: '💳', description: 'Hiển thị nút tính trả góp' },
  { id: 'compare', label: 'So sánh sản phẩm', icon: '⚖️', description: 'So sánh với sản phẩm khác' },
  { id: 'tradeIn', label: 'Thu cũ đổi mới', icon: '🔄', description: 'Chương trình thu cũ đổi mới' },
  { id: 'promotion', label: 'Khung khuyến mãi', icon: '🎁', description: 'Ưu đãi, quà tặng kèm' },
  { id: 'warranty', label: 'Khung bảo hành', icon: '🛡️', description: 'Chính sách bảo hành' },
  { id: 'description', label: 'Mô tả sản phẩm', icon: '📝', description: 'Nội dung chi tiết sản phẩm' },
  { id: 'relatedProducts', label: 'Sản phẩm liên quan', icon: '📦', description: 'SP cùng danh mục' },
  { id: 'reviews', label: 'Đánh giá khách hàng', icon: '💬', description: 'Đánh giá & nhận xét' },
  { id: 'recentlyViewed', label: 'Đã xem gần đây', icon: '👁️', description: 'Sản phẩm khách vừa xem' },
  { id: 'storeInfo', label: 'Thông tin cửa hàng', icon: '📞', description: 'Liên hệ, hotline' },
];

const EXTRA_LAYOUT_PRESETS = SYSTEM_PAGES
  .filter(p => !['home', 'products', 'news', 'warranty'].includes(p.id))
  .filter(p => !ALL_DETAIL_SECTIONS.some(s => s.id === p.id));

function getDefaultSections(): ProductDetailSectionItem[] {
  return [
    { id: 'installment', enabled: true },
    { id: 'compare', enabled: false },
    { id: 'tradeIn', enabled: false },
    { id: 'promotion', enabled: true },
    { id: 'warranty', enabled: true },
    { id: 'description', enabled: true },
    { id: 'relatedProducts', enabled: true },
    { id: 'reviews', enabled: false },
    { id: 'recentlyViewed', enabled: false },
    { id: 'storeInfo', enabled: false },
  ];
}

// Migrate old sections that don't have new items
export function migrateSections(sections: ProductDetailSectionItem[]): ProductDetailSectionItem[] {
  const ids = sections.map(s => s.id);
  const newItems: ProductDetailSectionItem[] = [];
  
  // Add missing new feature items at the beginning
  if (!ids.includes('installment')) newItems.push({ id: 'installment', enabled: true });
  if (!ids.includes('compare')) newItems.push({ id: 'compare', enabled: false });
  if (!ids.includes('tradeIn')) newItems.push({ id: 'tradeIn', enabled: false });
  
  if (newItems.length > 0) {
    return [...newItems, ...sections];
  }
  return sections;
}

function getSectionMeta(id: string) {
  if (id.startsWith('layout_')) {
    const pageId = id.replace(/^layout_\d+_/, '').replace(/^layout_/, '');
    const page = SYSTEM_PAGES.find(p => p.id === pageId);
    if (page) return { label: page.label, icon: page.icon, description: page.description };
  }
  return ALL_DETAIL_SECTIONS.find(s => s.id === id) || { label: id, icon: '📦', description: '' };
}

interface ProductDetailSectionManagerProps {
  customSections: ProductDetailSectionItem[] | null;
  onChange: (sections: ProductDetailSectionItem[] | null) => void;
}

export function ProductDetailSectionManager({ customSections, onChange }: ProductDetailSectionManagerProps) {
  const rawItems = customSections || getDefaultSections();
  const currentItems = migrateSections(rawItems);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleToggle = (index: number) => {
    const updated = [...currentItems];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    onChange(updated);
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

  const handleReset = () => onChange(null);

  const isLayoutSection = (id: string) => id.startsWith('layout_');

  const addLayoutSection = (pageId: string) => {
    const sectionId = `layout_${Date.now()}_${pageId}`;
    onChange([...currentItems, { id: sectionId, enabled: true }]);
    setShowAddMenu(false);
  };

  const removeLayoutSection = (sectionId: string) => {
    onChange(currentItems.filter(s => s.id !== sectionId));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {customSections && (
          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Mặc định
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {currentItems.map((item, i) => {
          const meta = getSectionMeta(item.id);
          const isLayout = isLayoutSection(item.id);
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-lg border p-2.5 transition-all ${
                item.enabled ? 'bg-background' : 'bg-muted/40 opacity-60'
              }`}
            >
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

              <span className="text-lg shrink-0">{meta.icon}</span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{meta.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{meta.description}</p>
              </div>

              {isLayout && (
                <button type="button" onClick={() => removeLayoutSection(item.id)}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}

              <Switch checked={item.enabled} onCheckedChange={() => handleToggle(i)} className="shrink-0" />
            </div>
          );
        })}
      </div>

      {/* Add Layout Button */}
      {!showAddMenu ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs border-dashed"
          onClick={() => setShowAddMenu(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm bố cục
        </Button>
      ) : (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Chọn trang chức năng</p>
            <button type="button" onClick={() => setShowAddMenu(false)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {EXTRA_LAYOUT_PRESETS.map(page => {
              const alreadyAdded = currentItems.some(it => it.id.includes(`_${page.id}`));
              return (
                <button
                  key={page.id}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addLayoutSection(page.id)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{page.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{page.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{page.description}</span>
                  </div>
                  {alreadyAdded && <span className="text-muted-foreground text-[10px]">Đã thêm</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        💡 Kéo lên/xuống để thay đổi thứ tự hiển thị. Các phần này nằm bên dưới giá & biến thể sản phẩm.
      </p>
    </div>
  );
}

// ===== CTA Buttons Editor =====
interface CTAButtonsEditorProps {
  buttons: CTAButtonItem[] | null;
  onChange: (buttons: CTAButtonItem[] | null) => void;
  templateId?: string;
}

export function CTAButtonsEditor({ buttons, onChange, templateId }: CTAButtonsEditorProps) {
  const currentButtons = buttons || getDefaultCTAButtons(templateId);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleToggle = (index: number) => {
    const updated = [...currentButtons];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...currentButtons];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= currentButtons.length - 1) return;
    const updated = [...currentButtons];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  const [showAddPicker, setShowAddPicker] = useState(false);

  const handleAddPreset = (opt: CTAActionOption) => {
    const newId = `cta_${Date.now()}`;
    onChange([...currentButtons, {
      id: newId,
      label: opt.defaultLabel,
      icon: opt.defaultIcon,
      action: opt.value,
      enabled: true,
      customUrl: '',
    }]);
    setShowAddPicker(false);
    setEditingId(newId);
  };

  const handleAddCustom = () => {
    const newId = `cta_${Date.now()}`;
    onChange([...currentButtons, {
      id: newId,
      label: 'Nút mới',
      icon: '🔗',
      action: 'custom_link',
      enabled: true,
      customUrl: '',
    }]);
    setShowAddPicker(false);
    setEditingId(newId);
  };

  const handleRemove = (index: number) => {
    const updated = currentButtons.filter((_, i) => i !== index);
    onChange(updated.length > 0 ? updated : null);
  };

  const handleUpdate = (index: number, field: string, value: string) => {
    const updated = [...currentButtons];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-update icon & label when action changes
    if (field === 'action') {
      const opt = CTA_ACTION_OPTIONS.find(o => o.value === value);
      if (opt) {
        updated[index].icon = opt.defaultIcon;
        updated[index].label = opt.defaultLabel;
      }
    }
    onChange(updated);
  };

  const handleReset = () => onChange(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Thanh nút hành động (CTA)</p>
        {buttons && (
          <Button type="button" variant="ghost" size="sm" className="text-xs h-6" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" /> Mặc định
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {currentButtons.map((btn, i) => (
          <div key={btn.id}>
            <div className={`flex items-center gap-2 rounded-lg border p-2 transition-all ${btn.enabled ? 'bg-background' : 'bg-muted/40 opacity-60'}`}>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button type="button" onClick={() => handleMoveUp(i)} disabled={i === 0}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => handleMoveDown(i)} disabled={i === currentButtons.length - 1}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              <span className="text-base shrink-0">{btn.icon}</span>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{btn.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {CTA_ACTION_OPTIONS.find(o => o.value === btn.action)?.label || btn.action}
                </p>
              </div>

              <button type="button" onClick={() => setEditingId(editingId === btn.id ? null : btn.id)}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground shrink-0">
                <GripVertical className="h-3.5 w-3.5" />
              </button>

              <button type="button" onClick={() => handleRemove(i)}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="h-3 w-3" />
              </button>

              <Switch checked={btn.enabled} onCheckedChange={() => handleToggle(i)} className="shrink-0" />
            </div>

            {/* Inline edit panel */}
            {editingId === btn.id && (
              <div className="ml-7 mt-1 p-2.5 border rounded-lg bg-muted/20 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Tên nút</Label>
                    <Input className="h-7 text-xs" value={btn.label} onChange={e => handleUpdate(i, 'label', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Icon</Label>
                    <Input className="h-7 text-xs" value={btn.icon} onChange={e => handleUpdate(i, 'icon', e.target.value)} placeholder="🛒" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Hành động</Label>
                  <Select value={btn.action} onValueChange={v => handleUpdate(i, 'action', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CTA_ACTION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {['custom_link', 'zalo', 'facebook', 'join_member'].includes(btn.action) && (
                  <div className="space-y-1">
                    <Label className="text-[10px]">
                      {btn.action === 'zalo' ? 'Link Zalo' : btn.action === 'facebook' ? 'Link Facebook' : btn.action === 'join_member' ? 'Link nhóm (Zalo/Facebook) *' : 'URL tùy chỉnh'}
                    </Label>
                    <Input
                      className={`h-7 text-xs ${btn.action === 'join_member' && !btn.customUrl?.trim() ? 'border-destructive ring-1 ring-destructive' : ''}`}
                      value={btn.customUrl || ''}
                      onChange={e => handleUpdate(i, 'customUrl', e.target.value)}
                      placeholder={btn.action === 'join_member' ? 'https://zalo.me/g/... hoặc fb.com/groups/...' : 'https://...'}
                    />
                    {btn.action === 'join_member' && !btn.customUrl?.trim() && (
                      <p className="text-[10px] text-destructive font-medium">⚠️ Điền link tham gia nhóm, nếu không nút sẽ không hoạt động</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {currentButtons.length < 10 && !showAddPicker && (
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={() => setShowAddPicker(true)}>
          <Plus className="h-3.5 w-3.5" /> Thêm nút
        </Button>
      )}

      {showAddPicker && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Chọn loại nút</p>
            <button type="button" onClick={() => setShowAddPicker(false)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {(() => {
              const categories = [...new Set(CTA_ACTION_OPTIONS.map(o => o.category))];
              return categories.map(cat => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{cat}</p>
                  <div className="space-y-0.5">
                    {CTA_ACTION_OPTIONS.filter(o => o.category === cat).map(opt => {
                      const alreadyAdded = currentButtons.some(b => b.action === opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleAddPreset(opt)}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2"
                        >
                          <span className="text-sm">{opt.defaultIcon}</span>
                          <span className="flex-1">{opt.defaultLabel}</span>
                          {alreadyAdded && <span className="text-[10px] text-muted-foreground">Đã thêm</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        💡 Tùy chỉnh các nút hành động hiển thị ở cuối trang chi tiết sản phẩm. Tối đa 10 nút.
      </p>
    </div>
  );
}