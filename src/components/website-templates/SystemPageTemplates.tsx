import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollReveal } from '@/hooks/useScrollReveal';
import { formatNumber } from '@/lib/formatNumber';
import {
  Wrench, RefreshCw, CreditCard, Headphones, BarChart3, DollarSign,
  Calendar, MapPin, Phone, Mail, Clock, CheckCircle, ArrowRight,
  Package, Star, Shield, ChevronRight, Users, FileText
} from 'lucide-react';

interface SystemPageProps {
  accentColor: string;
  storeName: string;
  storePhone?: string;
  zaloUrl?: string | null;
  branches?: { id: string; name: string; address?: string | null; phone?: string | null }[];
  onNavigateProducts?: () => void;
}

// === REPAIR PAGE ===
export function RepairPage({ accentColor, storeName, storePhone, zaloUrl }: SystemPageProps) {
  const commonIssues = [
    { icon: '📱', title: 'Thay màn hình', desc: 'Màn hình vỡ, sọc, chết điểm ảnh' },
    { icon: '🔋', title: 'Thay pin', desc: 'Pin chai, sập nguồn, phồng pin' },
    { icon: '📷', title: 'Sửa camera', desc: 'Camera mờ, không lấy nét, lỗi' },
    { icon: '🔊', title: 'Sửa loa / mic', desc: 'Loa nhỏ, mic không thu, rè' },
    { icon: '⚡', title: 'Sửa IC nguồn', desc: 'Không sạc, sập nguồn liên tục' },
    { icon: '💧', title: 'Xử lý vào nước', desc: 'Rơi nước, ẩm, không lên nguồn' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      {/* Banner */}
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}>
          <Wrench className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Dịch vụ sửa chữa</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">Đội ngũ kỹ thuật viên chuyên nghiệp – Linh kiện chính hãng – Bảo hành dài hạn</p>
        </div>
      </ScrollReveal>

      {/* Common Issues Grid */}
      <ScrollReveal animation="fade-up" delay={100}>
        <h2 className="text-lg font-bold mb-4">Lỗi phổ biến</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {commonIssues.map((issue, i) => (
            <div key={i} className="rounded-xl border p-4 hover:shadow-md transition-shadow">
              <span className="text-2xl">{issue.icon}</span>
              <h3 className="font-semibold text-sm mt-2">{issue.title}</h3>
              <p className="text-xs text-[#86868b] mt-1">{issue.desc}</p>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* Price Table */}
      <ScrollReveal animation="fade-up" delay={200}>
        <h2 className="text-lg font-bold mb-4">Bảng giá tham khảo</h2>
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f5f5f7]">
                <th className="text-left p-3 font-medium">Dịch vụ</th>
                <th className="text-right p-3 font-medium">Giá từ</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Thay màn hình', 'Liên hệ'],
                ['Thay pin', 'Liên hệ'],
                ['Sửa camera', 'Liên hệ'],
                ['Sửa loa / mic', 'Liên hệ'],
                ['Thay kính lưng', 'Liên hệ'],
                ['Vệ sinh máy', 'Liên hệ'],
              ].map(([service, price], i) => (
                <tr key={i} className="border-t">
                  <td className="p-3">{service}</td>
                  <td className="p-3 text-right font-medium" style={{ color: accentColor }}>{price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#86868b] mt-2">* Giá có thể thay đổi tùy model và tình trạng máy. Liên hệ để báo giá chính xác.</p>
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal animation="fade-up" delay={300}>
        <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center space-y-3">
          <h3 className="font-bold text-lg">Đặt lịch sửa chữa</h3>
          <p className="text-sm text-[#86868b]">Liên hệ ngay để được tư vấn và báo giá miễn phí</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {storePhone && (
              <a href={`tel:${storePhone}`} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
                <Phone className="h-4 w-4" /> Gọi ngay
              </a>
            )}
            {zaloUrl && (
              <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium border hover:bg-black/5 transition-colors">
                Chat Zalo
              </a>
            )}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

// === TRADE-IN PAGE ===
export function TradeInPage({ accentColor, storeName, storePhone, zaloUrl }: SystemPageProps) {
  const steps = [
    { step: '01', title: 'Mang máy đến cửa hàng', desc: 'Hoặc gửi thông tin qua Zalo' },
    { step: '02', title: 'Kiểm tra & định giá', desc: 'Kỹ thuật viên đánh giá trong 15 phút' },
    { step: '03', title: 'Chọn máy mới', desc: 'Thu cũ trừ thẳng vào giá máy mới' },
    { step: '04', title: 'Nhận máy mới', desc: 'Hoàn tất thủ tục nhanh chóng' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, #10b981, #059669)` }}>
          <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Thu cũ đổi mới</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">Lên đời máy mới dễ dàng – Giá thu tốt nhất thị trường</p>
        </div>
      </ScrollReveal>

      {/* Process Steps */}
      <ScrollReveal animation="fade-up" delay={100}>
        <h2 className="text-lg font-bold mb-4">Quy trình đổi máy</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {steps.map((s, i) => (
            <div key={i} className="rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold mb-2" style={{ color: accentColor }}>{s.step}</div>
              <h3 className="font-semibold text-sm">{s.title}</h3>
              <p className="text-xs text-[#86868b] mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* Benefits */}
      <ScrollReveal animation="fade-up" delay={200}>
        <div className="rounded-2xl bg-[#f5f5f7] p-6 space-y-3">
          <h2 className="text-lg font-bold">Tại sao chọn {storeName}?</h2>
          {[
            'Giá thu cao nhất thị trường',
            'Hỗ trợ trả góp phần chênh lệch',
            'Kiểm tra miễn phí, không mua không sao',
            'Thủ tục nhanh gọn trong 30 phút',
          ].map((benefit, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
              <span className="text-sm">{benefit}</span>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal animation="fade-up" delay={300}>
        <div className="text-center space-y-3">
          <h3 className="font-bold text-lg">Định giá máy ngay</h3>
          <p className="text-sm text-[#86868b]">Liên hệ để được báo giá thu mua nhanh nhất</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {storePhone && (
              <a href={`tel:${storePhone}`} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
                <Phone className="h-4 w-4" /> Gọi ngay
              </a>
            )}
            {zaloUrl && (
              <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium border hover:bg-black/5 transition-colors">
                Chat Zalo
              </a>
            )}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

// === INSTALLMENT PAGE ===
export function InstallmentPage({ accentColor, storeName, storePhone, zaloUrl, onNavigateProducts }: SystemPageProps) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, #f59e0b, #d97706)` }}>
          <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Trả góp 0%</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">Duyệt nhanh 15 phút – Thủ tục đơn giản – Không cần trả trước</p>
        </div>
      </ScrollReveal>

      {/* Requirements */}
      <ScrollReveal animation="fade-up" delay={100}>
        <h2 className="text-lg font-bold mb-4">Điều kiện đăng ký</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: <FileText className="h-5 w-5" />, title: 'CCCD/CMND', desc: 'Bản gốc còn hạn sử dụng' },
            { icon: <Users className="h-5 w-5" />, title: 'Từ 18 tuổi trở lên', desc: 'Có thu nhập ổn định' },
            { icon: <Phone className="h-5 w-5" />, title: 'SĐT chính chủ', desc: 'Đăng ký dưới tên bạn' },
            { icon: <CreditCard className="h-5 w-5" />, title: 'Không cần trả trước', desc: 'Hỗ trợ trả góp 0%' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border p-4">
              <div style={{ color: accentColor }}>{item.icon}</div>
              <div>
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="text-xs text-[#86868b] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* Partners */}
      <ScrollReveal animation="fade-up" delay={200}>
        <h2 className="text-lg font-bold mb-4">Đối tác tài chính</h2>
        <div className="flex flex-wrap gap-3">
          {['Home Credit', 'FE Credit', 'HD Saison', 'MCredit', 'Shinhan Finance'].map((p, i) => (
            <div key={i} className="rounded-full border px-4 py-2 text-sm font-medium">{p}</div>
          ))}
        </div>
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal animation="fade-up" delay={300}>
        <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center space-y-3">
          <h3 className="font-bold text-lg">Mua trả góp ngay</h3>
          <p className="text-sm text-[#86868b]">Chọn sản phẩm yêu thích và đăng ký trả góp tại cửa hàng</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {onNavigateProducts && (
              <Button onClick={onNavigateProducts} className="rounded-full px-6 text-white" style={{ backgroundColor: accentColor }}>
                Xem sản phẩm
              </Button>
            )}
            {storePhone && (
              <a href={`tel:${storePhone}`} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium border hover:bg-black/5 transition-colors">
                <Phone className="h-4 w-4" /> Gọi tư vấn
              </a>
            )}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

// === PRICE LIST PAGE ===
export function PriceListPage({ accentColor, storeName, storePhone }: SystemPageProps) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
          <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Bảng giá</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">Cập nhật mới nhất – Giá cạnh tranh nhất thị trường</p>
        </div>
      </ScrollReveal>

      <ScrollReveal animation="fade-up" delay={100}>
        <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center space-y-3">
          <p className="text-sm text-[#86868b]">Bảng giá được cập nhật theo thời gian thực từ kho hàng.</p>
          <p className="text-sm text-[#86868b]">Vui lòng liên hệ để nhận báo giá chính xác nhất.</p>
          {storePhone && (
            <a href={`tel:${storePhone}`} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
              <Phone className="h-4 w-4" /> Liên hệ báo giá
            </a>
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}

// === BOOKING PAGE ===
export function BookingPage({ accentColor, storeName, storePhone, zaloUrl }: SystemPageProps) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, #8b5cf6, #7c3aed)` }}>
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Đặt lịch</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">Đặt lịch nhanh chóng – Không cần chờ đợi</p>
        </div>
      </ScrollReveal>

      <ScrollReveal animation="fade-up" delay={100}>
        <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center space-y-4">
          <Clock className="h-8 w-8 mx-auto text-[#86868b]" />
          <h3 className="font-bold text-lg">Liên hệ để đặt lịch</h3>
          <p className="text-sm text-[#86868b] max-w-md mx-auto">Gọi điện hoặc nhắn Zalo để đặt lịch hẹn. Chúng tôi sẽ xác nhận và phục vụ bạn theo giờ đã hẹn.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {storePhone && (
              <a href={`tel:${storePhone}`} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
                <Phone className="h-4 w-4" /> Gọi đặt lịch
              </a>
            )}
            {zaloUrl && (
              <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium border hover:bg-black/5 transition-colors">
                Đặt qua Zalo
              </a>
            )}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

// === BRANCHES PAGE ===
export function BranchesPage({ accentColor, storeName, branches }: SystemPageProps) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, #0ea5e9, #0284c7)` }}>
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Hệ thống chi nhánh</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">{storeName} – Luôn ở gần bạn</p>
        </div>
      </ScrollReveal>

      <ScrollReveal animation="fade-up" delay={100}>
        {branches && branches.length > 0 ? (
          <div className="grid gap-3">
            {branches.map((b) => (
              <div key={b.id} className="rounded-xl border p-4 flex items-start gap-3">
                <MapPin className="h-5 w-5 shrink-0 mt-0.5" style={{ color: accentColor }} />
                <div>
                  <h3 className="font-semibold text-sm">{b.name}</h3>
                  {b.address && <p className="text-xs text-[#86868b] mt-1">{b.address}</p>}
                  {b.phone && (
                    <a href={`tel:${b.phone}`} className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: accentColor }}>
                      <Phone className="h-3 w-3" /> {b.phone}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center">
            <p className="text-sm text-[#86868b]">Thông tin chi nhánh đang được cập nhật.</p>
          </div>
        )}
      </ScrollReveal>
    </div>
  );
}

// === CONTACT PAGE ===
export function ContactPage({ accentColor, storeName, storePhone, zaloUrl, branches }: SystemPageProps) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}>
          <Phone className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Liên hệ</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">Chúng tôi luôn sẵn sàng hỗ trợ bạn</p>
        </div>
      </ScrollReveal>

      <ScrollReveal animation="fade-up" delay={100}>
        <div className="grid sm:grid-cols-2 gap-4">
          {storePhone && (
            <a href={`tel:${storePhone}`} className="rounded-xl border p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Điện thoại</p>
                <p className="text-xs text-[#86868b]">{storePhone}</p>
              </div>
            </a>
          )}
          {zaloUrl && (
            <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-blue-50 text-blue-600">
                <span className="text-lg font-bold">Z</span>
              </div>
              <div>
                <p className="font-semibold text-sm">Zalo</p>
                <p className="text-xs text-[#86868b]">Nhắn tin tư vấn</p>
              </div>
            </a>
          )}
        </div>
      </ScrollReveal>

      {branches && branches.length > 0 && (
        <ScrollReveal animation="fade-up" delay={200}>
          <h2 className="text-lg font-bold mb-3">Địa chỉ</h2>
          <div className="space-y-2">
            {branches.map(b => (
              <div key={b.id} className="rounded-xl bg-[#f5f5f7] p-4">
                <p className="font-medium text-sm">{b.name}</p>
                {b.address && <p className="text-xs text-[#86868b] mt-1">{b.address}</p>}
              </div>
            ))}
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}

// === ACCESSORIES PAGE (shows products filtered) ===
export function AccessoriesPage({ accentColor, storeName, onNavigateProducts }: SystemPageProps) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, #6366f1, #4f46e5)` }}>
          <Headphones className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Phụ kiện chính hãng</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">Nâng tầm trải nghiệm với phụ kiện cao cấp</p>
        </div>
      </ScrollReveal>

      <ScrollReveal animation="fade-up" delay={100}>
        <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center space-y-3">
          <Package className="h-8 w-8 mx-auto text-[#86868b]" />
          <p className="text-sm text-[#86868b]">Xem danh sách phụ kiện trong mục Sản phẩm</p>
          {onNavigateProducts && (
            <Button onClick={onNavigateProducts} className="rounded-full px-6 text-white" style={{ backgroundColor: accentColor }}>
              Xem sản phẩm <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}

// === COMPARE PAGE ===
export function ComparePage({ accentColor, storeName, onNavigateProducts }: SystemPageProps) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, #14b8a6, #0d9488)` }}>
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">So sánh sản phẩm</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">So sánh cấu hình, giá cả để chọn sản phẩm phù hợp nhất</p>
        </div>
      </ScrollReveal>

      <ScrollReveal animation="fade-up" delay={100}>
        <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center space-y-3">
          <p className="text-sm text-[#86868b]">Tính năng so sánh đang được phát triển. Vui lòng liên hệ để được tư vấn.</p>
          {onNavigateProducts && (
            <Button onClick={onNavigateProducts} className="rounded-full px-6 text-white" style={{ backgroundColor: accentColor }}>
              Xem sản phẩm <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}

// === GENERIC SYSTEM PAGE (fallback for unmapped pages) ===
export function GenericSystemPage({ pageId, pageLabel, accentColor, storeName, storePhone, zaloUrl }: SystemPageProps & { pageId: string; pageLabel: string }) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-10">
      <ScrollReveal animation="fade-up">
        <div className="rounded-2xl p-8 text-white text-center" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{pageLabel}</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">{storeName}</p>
        </div>
      </ScrollReveal>

      <ScrollReveal animation="fade-up" delay={100}>
        <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center space-y-3">
          <p className="text-sm text-[#86868b]">Nội dung đang được cập nhật.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {storePhone && (
              <a href={`tel:${storePhone}`} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
                <Phone className="h-4 w-4" /> Liên hệ
              </a>
            )}
            {zaloUrl && (
              <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium border hover:bg-black/5 transition-colors">
                Chat Zalo
              </a>
            )}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
