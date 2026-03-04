import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SYSTEM_PAGES } from '@/lib/industryConfig';

// Gradient presets per pageId for visual variety
const BANNER_GRADIENTS: Record<string, string> = {
  installment: 'from-amber-400 to-orange-500',
  tradein: 'from-emerald-400 to-teal-600',
  repair: 'from-blue-400 to-indigo-600',
  pricelist: 'from-violet-400 to-purple-600',
  booking: 'from-pink-400 to-rose-600',
  branches: 'from-cyan-400 to-blue-600',
  contact: 'from-slate-500 to-gray-700',
  accessories: 'from-fuchsia-400 to-pink-600',
  compare: 'from-sky-400 to-blue-600',
  services: 'from-teal-400 to-emerald-600',
  rooms: 'from-amber-500 to-yellow-600',
  courses: 'from-indigo-400 to-violet-600',
  doctors: 'from-green-400 to-emerald-600',
  collection: 'from-rose-400 to-pink-600',
  promotion: 'from-red-400 to-orange-500',
  reviews: 'from-yellow-400 to-amber-500',
};

const BANNER_SUBTITLES: Record<string, string> = {
  installment: 'Duyệt nhanh 15 phút – Thủ tục đơn giản – Không cần trả trước',
  tradein: 'Định giá cao – Thu cũ đổi mới nhanh chóng',
  repair: 'Sửa chữa chính hãng – Bảo hành dài hạn',
  pricelist: 'Cập nhật giá mới nhất hàng ngày',
  booking: 'Đặt lịch hẹn nhanh chóng, tiện lợi',
  branches: 'Hệ thống cửa hàng trên toàn quốc',
  contact: 'Liên hệ tư vấn & hỗ trợ 24/7',
  accessories: 'Phụ kiện chính hãng – Giá tốt nhất',
  compare: 'So sánh cấu hình & giá để chọn đúng sản phẩm',
  services: 'Dịch vụ chuyên nghiệp, tận tâm',
  rooms: 'Đa dạng phòng – Giá hợp lý',
  courses: 'Khóa học chất lượng cao',
  doctors: 'Đội ngũ bác sĩ giàu kinh nghiệm',
  collection: 'Bộ sưu tập mới nhất',
  promotion: 'Ưu đãi hấp dẫn – Không thể bỏ lỡ',
  reviews: 'Đánh giá từ khách hàng thực tế',
};

interface LayoutBannerCollapsibleProps {
  pageId: string;
  accentColor: string;
  children: React.ReactNode;
}

export default function LayoutBannerCollapsible({ pageId, accentColor, children }: LayoutBannerCollapsibleProps) {
  const [expanded, setExpanded] = useState(false);
  const page = SYSTEM_PAGES.find(p => p.id === pageId);
  if (!page) return null;

  const gradient = BANNER_GRADIENTS[pageId] || 'from-gray-500 to-gray-700';
  const subtitle = BANNER_SUBTITLES[pageId] || page.description;

  return (
    <div className="my-4">
      {/* Banner */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white text-left transition-all duration-300 hover:shadow-lg active:scale-[0.99] relative overflow-hidden`}
      >
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <div className="relative z-10 flex flex-col items-center text-center gap-2">
          <span className="text-3xl">{page.icon}</span>
          <h3 className="text-xl font-bold tracking-tight">{page.label}</h3>
          <p className="text-sm text-white/80 max-w-md">{subtitle}</p>
          <ChevronDown className={`h-5 w-5 mt-1 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expandable content */}
      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${expanded ? 'max-h-[5000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
      >
        {expanded && children}
      </div>
    </div>
  );
}
