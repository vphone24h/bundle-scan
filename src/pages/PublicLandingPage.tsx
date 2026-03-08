import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import vkhoLogo from '@/assets/vkho-logo.png';
// Only import icons actually used on initial render - others lazy loaded via tree-shaking
import { 
  Package, BarChart3, Users, Shield, Smartphone,
  CheckCircle2, ArrowRight, Store, Receipt, TrendingUp,
  Phone, Mail, ChevronRight, Zap, Globe
} from 'lucide-react';

export default function PublicLandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Package,
      title: 'Quản lý kho thông minh',
      description: 'Theo dõi tồn kho theo IMEI, mã vạch với độ chính xác tuyệt đối',
    },
    {
      icon: BarChart3,
      title: 'Báo cáo lợi nhuận 100%',
      description: 'Phân tích lợi nhuận chi tiết từng sản phẩm, từng giao dịch',
    },
    {
      icon: Shield,
      title: 'An toàn & Bảo mật',
      description: 'Nền tảng an toàn, bảo mật tuyệt đối cho dữ liệu của bạn',
    },
    {
      icon: Users,
      title: 'Quản lý đa chi nhánh',
      description: 'Quản lý nhiều cửa hàng trên cùng một nền tảng',
    },
    {
      icon: TrendingUp,
      title: 'Công nợ minh bạch',
      description: 'Theo dõi công nợ khách hàng, nhà cung cấp rõ ràng',
    },
    {
      icon: Receipt,
      title: 'Website bán hàng miễn phí',
      description: 'Tích hợp website riêng, tra cứu bảo hành, giữ chân khách hàng hiệu quả',
    },
    {
      icon: Smartphone,
      title: 'Sử dụng mọi lúc mọi nơi',
      description: 'Giao diện tối ưu cho điện thoại, máy tính bảng và PC',
    },
  ];

  const stats = [
    { value: '1000+', label: 'Cửa hàng tin dùng' },
    { value: '100%', label: 'Chính xác lợi nhuận' },
    { value: '24/7', label: 'Hỗ trợ khách hàng' },
    { value: '99.9%', label: 'Uptime hệ thống' },
  ];

  const benefits = [
    'Dễ dàng sử dụng, không cần đào tạo phức tạp',
    'Báo cáo lợi nhuận chi tiết, chính xác từng đồng',
    'Quản lý tồn kho theo IMEI/Serial Number',
    
    'Nền tảng an toàn, bảo mật tuyệt đối',
    'Hỗ trợ nhiều chi nhánh trên cùng tài khoản',
    'Ứng dụng PWA - cài đặt như app native',
    'Sao lưu dữ liệu tự động, an toàn tuyệt đối',
    'Cập nhật tính năng miễn phí liên tục',
    'Website miễn phí - tra cứu bảo hành - giữ chân khách hàng',
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header - optimized for PWA standalone mode */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-[env(safe-area-inset-top)]">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <img src={vkhoLogo} alt="vkho.vn" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-base sm:text-lg text-primary">vkho.vn</span>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground -mt-1 truncate">Quản lý thông minh</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9" onClick={() => navigate('/auth')}>
              Đăng nhập
            </Button>
            <Button size="sm" className="text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9 whitespace-nowrap" onClick={() => navigate('/register')}>
              <span className="hidden xs:inline">Dùng Miễn phí</span>
              <span className="xs:hidden">Đăng ký</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Zap className="h-3 w-3" />
              Dùng Miễn phí
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              Nền tảng quản lý kho
              <span className="block text-primary mt-2">Dễ dùng - Chi tiết - Chính xác</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Báo cáo lợi nhuận chính xác <strong className="text-primary">100%</strong> từng sản phẩm. 
              Quản lý tồn kho theo IMEI, mã vạch.
              Website miễn phí, tra cứu bảo hành & giữ chân khách hàng.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 px-4 py-2 text-sm font-semibold text-primary">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Sử dụng miễn phí trọn đời
            </div>
            <div className="mt-6 flex justify-center">
              <Button size="lg" className="gap-2 text-base" onClick={() => navigate('/register')}>
                Bắt đầu miễn phí
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">Tính năng nổi bật</Badge>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              Tất cả những gì bạn cần để quản lý kho hiệu quả
            </h2>
            <p className="mt-4 text-muted-foreground">
              Từ nhập hàng, xuất hàng đến báo cáo lợi nhuận - tất cả trong một nền tảng duy nhất
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="group relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/50">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="outline" className="mb-4">Lợi ích</Badge>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                Tại sao chọn vkho.vn?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Được thiết kế dành riêng cho các cửa hàng điện thoại, điện máy tại Việt Nam
              </p>
              <div className="mt-8 space-y-3">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
                <CardContent className="p-8">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Store className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                  <p className="font-semibold text-foreground">Dùng miễn phí</p>
                  <p className="text-sm text-muted-foreground">Đầy đủ tính năng</p>
                </div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Miễn phí trọn đời
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Hỗ trợ cài đặt ban đầu
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Hướng dẫn sử dụng chi tiết
                    </li>
                  </ul>
                  <Button className="w-full gap-2" size="lg" onClick={() => navigate('/register')}>
                    Đăng ký ngay
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <Card className="border-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-8 md:p-12 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
                Sẵn sàng nâng cấp quản lý kho?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-primary-foreground/90">
                Tham gia cùng hàng nghìn cửa hàng đang sử dụng vkho.vn để quản lý hiệu quả hơn mỗi ngày
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button size="lg" variant="secondary" className="gap-2" onClick={() => navigate('/register')}>
                  Dùng miễn phí
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={vkhoLogo} alt="vkho.vn" className="h-10 w-10 rounded-lg" />
                <div>
                  <span className="font-bold text-lg text-primary">vkho.vn</span>
                  <p className="text-xs text-muted-foreground">Quản lý thông minh</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Nền tảng quản lý kho chuyên nghiệp dành cho cửa hàng điện thoại, điện máy tại Việt Nam.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Liên hệ</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <a href="tel:0396793883" className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Phone className="h-4 w-4" />
                  0396.793.883
                </a>
                <a href="mailto:vkho.vn@gmail.com" className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Mail className="h-4 w-4" />
                  vkho.vn@gmail.com
                </a>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  vkho.vn
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Tính năng</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Quản lý sản phẩm & IMEI</li>
                <li>Nhập xuất kho</li>
                <li>Báo cáo lợi nhuận</li>
                <li>Quản lý công nợ</li>
                <li>Website bán hàng miễn phí</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} vkho.vn - Nền tảng quản lý kho thông minh. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
