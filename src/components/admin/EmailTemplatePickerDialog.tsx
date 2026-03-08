import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, PenLine, Clock, ShieldCheck, Package, Star, ShoppingCart, CheckCircle2, Truck, Shield, CalendarCheck, CalendarClock, UtensilsCrossed, BedDouble, GraduationCap, Car, Heart, Cake, UserPlus, Gift, MessageSquare, XCircle } from 'lucide-react';

export interface EmailTemplatePreset {
  id: string;
  name: string;
  triggerType: string;
  triggerDays: number;
  subject: string;
  icon: React.ElementType;
  description: string;
  blocks: Array<{ block_type: string; content: any }>;
}

// === 4 Order Email Presets ===
export const ORDER_EMAIL_PRESETS: EmailTemplatePreset[] = [
  {
    id: 'order_confirmation',
    name: 'Email xác nhận đơn hàng',
    triggerType: 'on_order_confirmation',
    triggerDays: 0,
    subject: 'Xác nhận đơn hàng tại {{store_name}}',
    icon: ShoppingCart,
    description: 'Gửi ngay khi khách đặt hàng',
    blocks: [
      { block_type: 'heading', content: { text: '✅ Xác nhận đơn hàng', level: 'h1' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nCảm ơn bạn đã đặt hàng tại {{store_name}}.' } },
      { block_type: 'text', content: { text: '📦 Sản phẩm: {{product_name}}\n💰 Giá: {{product_price}}\n🔖 Mã đơn: {{order_code}}' } },
      { block_type: 'divider', content: {} },
      { block_type: 'text', content: { text: 'Cửa hàng sẽ liên hệ với bạn sớm nhất.' } },
      { block_type: 'button', content: { text: '📞 Gọi điện', url: 'tel:{{phone}}', color: '#1a56db' } },
      { block_type: 'spacer', content: { height: 12 } },
      { block_type: 'text', content: { text: 'Trân trọng,\n{{store_name}}' } },
    ],
  },
  {
    id: 'order_confirmed',
    name: 'Email khi đơn đã xác nhận',
    triggerType: 'on_order_confirmed',
    triggerDays: 0,
    subject: 'Đơn hàng đã được xác nhận - {{store_name}}',
    icon: CheckCircle2,
    description: 'Gửi khi cửa hàng xác nhận đơn',
    blocks: [
      { block_type: 'heading', content: { text: '✅ Đơn hàng đã xác nhận', level: 'h1' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nĐơn hàng {{order_code}} của bạn đã được xác nhận.' } },
      { block_type: 'text', content: { text: '📦 Sản phẩm: {{product_name}}\n💰 Giá: {{product_price}}' } },
      { block_type: 'divider', content: {} },
      { block_type: 'text', content: { text: 'Chúng tôi sẽ chuẩn bị hàng cho bạn.' } },
      { block_type: 'spacer', content: { height: 12 } },
      { block_type: 'text', content: { text: 'Trân trọng,\n{{store_name}}' } },
    ],
  },
  {
    id: 'order_shipping',
    name: 'Email khi giao hàng',
    triggerType: 'on_order_shipping',
    triggerDays: 0,
    subject: 'Đơn hàng đang được giao - {{store_name}}',
    icon: Truck,
    description: 'Gửi khi đơn hàng bắt đầu giao',
    blocks: [
      { block_type: 'heading', content: { text: '🚚 Đang giao hàng', level: 'h1' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nĐơn hàng {{order_code}} đang được giao đến bạn.' } },
      { block_type: 'text', content: { text: '📦 Sản phẩm: {{product_name}}' } },
      { block_type: 'divider', content: {} },
      { block_type: 'text', content: { text: 'Vui lòng chuẩn bị nhận hàng. Nếu cần hỗ trợ, hãy liên hệ:' } },
      { block_type: 'button', content: { text: '📞 Gọi Hotline', url: 'tel:{{phone}}', color: '#3182ce' } },
      { block_type: 'spacer', content: { height: 12 } },
      { block_type: 'text', content: { text: 'Trân trọng,\n{{store_name}}' } },
    ],
  },
  {
    id: 'order_warranty',
    name: 'Email bảo hành',
    triggerType: 'on_order_warranty',
    triggerDays: 0,
    subject: 'Thông tin bảo hành sản phẩm - {{store_name}}',
    icon: Shield,
    description: 'Gửi thông tin bảo hành sau khi mua',
    blocks: [
      { block_type: 'heading', content: { text: '🛡️ Thông tin bảo hành', level: 'h1' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nDưới đây là thông tin bảo hành sản phẩm bạn vừa mua tại {{store_name}}.' } },
      { block_type: 'text', content: { text: '📦 Sản phẩm: {{product_name}}\n📅 Ngày mua: {{purchase_date}}\n🔖 Mã đơn: {{order_code}}' } },
      { block_type: 'divider', content: {} },
      { block_type: 'text', content: { text: 'Nếu gặp vấn đề trong quá trình sử dụng, vui lòng mang sản phẩm đến cửa hàng để được hỗ trợ.' } },
      { block_type: 'button', content: { text: '📍 Xem địa chỉ', url: 'https://maps.google.com/', color: '#16a34a' } },
      { block_type: 'button', content: { text: '📞 Hotline', url: 'tel:{{phone}}', color: '#1a56db' } },
      { block_type: 'spacer', content: { height: 12 } },
      { block_type: 'text', content: { text: 'Trân trọng,\n{{store_name}}' } },
    ],
  },
];

export const EMAIL_TEMPLATE_PRESETS: EmailTemplatePreset[] = [
  {
    id: 'after_7_days',
    name: 'Chăm sóc sau 7 ngày mua hàng',
    triggerType: 'days_after_purchase',
    triggerDays: 7,
    subject: 'Cảm ơn bạn đã tin tưởng sản phẩm của chúng tôi',
    icon: Clock,
    description: 'Hỏi thăm trải nghiệm, hỗ trợ tư vấn phụ kiện',
    blocks: [
      { block_type: 'heading', content: { text: 'Cảm ơn bạn đã tin tưởng sản phẩm của chúng tôi', level: 'h2' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nĐã khoảng một tuần kể từ khi bạn mua {{product_name}} tại cửa hàng chúng tôi.\n\nChúng tôi hy vọng bạn đang có trải nghiệm tốt với sản phẩm.\n\nNếu trong quá trình sử dụng bạn cần hỗ trợ, tư vấn phụ kiện hoặc giải đáp thắc mắc, hãy liên hệ với chúng tôi bất cứ lúc nào.' } },
      { block_type: 'divider', content: {} },
      { block_type: 'button', content: { text: '📞 Gọi điện', url: 'tel:', color: '#1a56db' } },
      { block_type: 'button', content: { text: '💬 Chat Zalo', url: 'https://zalo.me/', color: '#0068ff' } },
      { block_type: 'button', content: { text: '📍 Xem địa chỉ', url: 'https://maps.google.com/', color: '#16a34a' } },
      { block_type: 'spacer', content: { height: 12 } },
      { block_type: 'text', content: { text: 'Cảm ơn bạn đã tin tưởng và lựa chọn chúng tôi.' } },
    ],
  },
  {
    id: 'after_30_days',
    name: 'Giới thiệu phụ kiện sau 30 ngày',
    triggerType: 'days_after_purchase',
    triggerDays: 30,
    subject: 'Một vài phụ kiện phù hợp cho thiết bị của bạn',
    icon: Package,
    description: 'Gợi ý phụ kiện nâng cao trải nghiệm',
    blocks: [
      { block_type: 'heading', content: { text: 'Một vài phụ kiện phù hợp cho thiết bị của bạn', level: 'h2' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nSau một thời gian sử dụng {{product_name}}, nhiều khách hàng thường lựa chọn thêm một số phụ kiện để nâng cao trải nghiệm sử dụng.\n\nBạn có thể tham khảo thêm:\n• Ốp lưng bảo vệ\n• Kính cường lực\n• Sạc nhanh\n• Tai nghe không dây' } },
      { block_type: 'divider', content: {} },
      { block_type: 'button', content: { text: '🛒 Xem sản phẩm', url: '/', color: '#1a56db' } },
      { block_type: 'button', content: { text: '📞 Gọi tư vấn', url: 'tel:', color: '#16a34a' } },
      { block_type: 'spacer', content: { height: 12 } },
      { block_type: 'text', content: { text: 'Chúng tôi luôn sẵn sàng hỗ trợ bạn.' } },
    ],
  },
  {
    id: 'warranty_10_days',
    name: 'Nhắc bảo hành trước 10 ngày',
    triggerType: 'days_before_warranty_expires',
    triggerDays: 10,
    subject: 'Thông báo bảo hành sản phẩm sắp hết hạn',
    icon: ShieldCheck,
    description: 'Nhắc khách kiểm tra thiết bị trước khi hết hạn bảo hành',
    blocks: [
      { block_type: 'heading', content: { text: 'Thông báo bảo hành sản phẩm sắp hết hạn', level: 'h2' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nChúng tôi xin thông báo rằng thời hạn bảo hành của sản phẩm {{product_name}} sẽ hết trong khoảng 10 ngày tới.\n\nBạn có thể mang thiết bị đến cửa hàng để:\n• Kiểm tra tổng thể thiết bị\n• Vệ sinh máy miễn phí\n• Kiểm tra pin và linh kiện\n\nNếu phát hiện lỗi trong thời gian bảo hành, chúng tôi sẽ hỗ trợ xử lý theo chính sách của cửa hàng.' } },
      { block_type: 'divider', content: {} },
      { block_type: 'button', content: { text: '📍 Xem địa chỉ cửa hàng', url: 'https://maps.google.com/', color: '#1a56db' } },
      { block_type: 'button', content: { text: '📞 Gọi Hotline', url: 'tel:', color: '#16a34a' } },
      { block_type: 'spacer', content: { height: 12 } },
      { block_type: 'text', content: { text: 'Rất hân hạnh được phục vụ bạn.' } },
    ],
  },
  {
    id: 'after_1_year',
    name: 'Gợi ý kiểm tra sau 1 năm',
    triggerType: 'days_after_purchase',
    triggerDays: 365,
    subject: 'Gợi ý kiểm tra và nâng cấp thiết bị của bạn',
    icon: Star,
    description: 'Nhắc kiểm tra pin, vệ sinh máy, gợi ý nâng cấp',
    blocks: [
      { block_type: 'heading', content: { text: 'Gợi ý kiểm tra và nâng cấp thiết bị của bạn', level: 'h2' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nĐã khoảng 1 năm kể từ khi bạn mua {{product_name}} tại cửa hàng chúng tôi.\n\nSau thời gian sử dụng, bạn có thể cân nhắc:\n• Kiểm tra pin và hiệu suất thiết bị\n• Vệ sinh máy định kỳ\n• Cập nhật phụ kiện mới\n\nNếu bạn đang muốn nâng cấp thiết bị mới, chúng tôi luôn sẵn sàng tư vấn những lựa chọn phù hợp.' } },
      { block_type: 'divider', content: {} },
      { block_type: 'button', content: { text: '📞 Gọi tư vấn', url: 'tel:', color: '#1a56db' } },
      { block_type: 'button', content: { text: '🌐 Xem Website', url: '/', color: '#16a34a' } },
    ],
  },
  {
    id: 'after_2_years',
    name: 'Ưu đãi nâng cấp sau 2 năm',
    triggerType: 'days_after_purchase',
    triggerDays: 730,
    subject: 'Ưu đãi nâng cấp thiết bị dành riêng cho bạn',
    icon: Star,
    description: 'Thu cũ đổi mới, giảm giá nâng cấp dành cho khách cũ',
    blocks: [
      { block_type: 'heading', content: { text: 'Ưu đãi nâng cấp thiết bị dành riêng cho bạn', level: 'h2' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nĐã hơn 2 năm kể từ khi bạn mua {{product_name}}.\n\nĐây thường là thời điểm nhiều khách hàng lựa chọn nâng cấp thiết bị mới với công nghệ và hiệu năng tốt hơn.\n\nChúng tôi hiện có các chương trình dành riêng cho khách hàng cũ:\n• Thu cũ đổi mới\n• Giảm giá khi nâng cấp máy\n• Ưu đãi phụ kiện kèm theo\n\nNếu bạn cần tư vấn, hãy liên hệ với chúng tôi.' } },
      { block_type: 'divider', content: {} },
      { block_type: 'button', content: { text: '📞 Gọi Hotline', url: 'tel:', color: '#1a56db' } },
      { block_type: 'button', content: { text: '💬 Chat Zalo', url: 'https://zalo.me/', color: '#0068ff' } },
      { block_type: 'button', content: { text: '🌐 Xem Website', url: '/', color: '#16a34a' } },
      { block_type: 'spacer', content: { height: 12 } },
      { block_type: 'text', content: { text: 'Cảm ơn bạn đã luôn đồng hành cùng chúng tôi.' } },
    ],
  },
  {
    id: 'onwards_7_days',
    name: 'Chăm sóc khách mua từ 7 ngày trở đi',
    triggerType: 'days_after_purchase_onwards',
    triggerDays: 7,
    subject: 'Cảm ơn bạn đã mua hàng tại {{store_name}}',
    icon: Clock,
    description: 'Gửi cho tất cả khách đã mua hàng từ 7 ngày trở lên, mỗi khách chỉ nhận 1 lần',
    blocks: [
      { block_type: 'heading', content: { text: 'Cảm ơn bạn đã mua hàng tại {{store_name}}', level: 'h2' } },
      { block_type: 'text', content: { text: 'Xin chào {{customer_name}},\n\nCảm ơn bạn đã tin tưởng và mua sắm tại cửa hàng chúng tôi.\n\nChúng tôi muốn đảm bảo rằng bạn luôn có trải nghiệm tốt nhất với sản phẩm. Nếu bạn cần bất kỳ hỗ trợ nào, đừng ngần ngại liên hệ với chúng tôi nhé!\n\n• Hỗ trợ kỹ thuật\n• Tư vấn phụ kiện\n• Chính sách bảo hành' } },
      { block_type: 'staff_info', content: { label: 'Nhân viên tư vấn' } },
      { block_type: 'divider', content: {} },
      { block_type: 'button', content: { text: '📞 Gọi Hotline', url: 'tel:', color: '#1a56db' } },
      { block_type: 'button', content: { text: '🌐 Xem Website', url: '/', color: '#16a34a' } },
      { block_type: 'spacer', content: { height: 12 } },
      { block_type: 'text', content: { text: 'Trân trọng,\n{{store_name}}' } },
    ],
  },
];

interface EmailTemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: EmailTemplatePreset) => void;
  onCreateManual: () => void;
}

export function EmailTemplatePickerDialog({ open, onOpenChange, onSelectTemplate, onCreateManual }: EmailTemplatePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo kịch bản mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Manual option */}
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { onOpenChange(false); onCreateManual(); }}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <PenLine className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-sm">Tạo thủ công</h4>
                <p className="text-xs text-muted-foreground">Tự thiết lập điều kiện gửi và nội dung email từ đầu</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground px-2">Hoặc chọn từ mẫu có sẵn</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Template options */}
          <div className="space-y-2">
            {EMAIL_TEMPLATE_PRESETS.map((tpl) => (
              <Card key={tpl.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { onOpenChange(false); onSelectTemplate(tpl); }}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <tpl.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">{tpl.name}</h4>
                      <Badge variant="secondary" className="text-[10px]">{tpl.triggerDays} ngày</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">Subject: {tpl.subject}</p>
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
