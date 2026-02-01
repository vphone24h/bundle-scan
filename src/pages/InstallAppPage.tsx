import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Download, 
  Share, 
  Plus, 
  CheckCircle2, 
  Apple, 
  Chrome,
  MoreVertical,
  Home,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallAppPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt (Android/Desktop Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-green-800">Đã cài đặt thành công!</h2>
                <p className="text-green-600 mt-1">
                  Ứng dụng vkho.vn đã được thêm vào màn hình chính của bạn.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Miễn phí
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">Tải ứng dụng về máy</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Cài đặt vkho.vn như một ứng dụng trên điện thoại để truy cập nhanh hơn
        </p>
      </div>

      {/* Quick Install Button for Android */}
      {deferredPrompt && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Download className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-semibold">Cài đặt ngay</h3>
                <p className="text-sm text-muted-foreground">
                  Nhấn nút bên dưới để thêm ứng dụng vào màn hình chính
                </p>
              </div>
              <Button onClick={handleInstallClick} size="lg" className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Cài đặt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Installation Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Hướng dẫn cài đặt
          </CardTitle>
          <CardDescription>
            Chọn loại thiết bị của bạn để xem hướng dẫn chi tiết
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={isIOS ? 'ios' : isAndroid ? 'android' : 'ios'} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ios" className="flex items-center gap-2">
                <Apple className="h-4 w-4" />
                iPhone / iPad
              </TabsTrigger>
              <TabsTrigger value="android" className="flex items-center gap-2">
                <Chrome className="h-4 w-4" />
                Android
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ios" className="mt-6 space-y-4">
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      1
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h4 className="font-medium mb-1">Mở bằng Safari</h4>
                    <p className="text-sm text-muted-foreground">
                      Đảm bảo bạn đang mở trang web này bằng trình duyệt <strong>Safari</strong> (không phải Chrome hay trình duyệt khác)
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      2
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h4 className="font-medium mb-1 flex items-center gap-2">
                      Nhấn nút Chia sẻ
                      <Share className="h-4 w-4 text-primary" />
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Nhấn vào biểu tượng <strong>Chia sẻ</strong> (hình vuông có mũi tên hướng lên) ở thanh công cụ phía dưới màn hình
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      3
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h4 className="font-medium mb-1 flex items-center gap-2">
                      Chọn "Thêm vào MH chính"
                      <Plus className="h-4 w-4 text-primary" />
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Cuộn xuống và chọn <strong>"Thêm vào Màn hình chính"</strong> (Add to Home Screen)
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      4
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h4 className="font-medium mb-1">Xác nhận thêm</h4>
                    <p className="text-sm text-muted-foreground">
                      Nhấn <strong>"Thêm"</strong> ở góc trên bên phải để hoàn tất
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex gap-3">
                  <Home className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Sau khi hoàn tất</p>
                    <p className="text-sm text-blue-600">
                      Biểu tượng vkho.vn sẽ xuất hiện trên màn hình chính. Nhấn vào để mở ứng dụng như bình thường!
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="android" className="mt-6 space-y-4">
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      1
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h4 className="font-medium mb-1">Mở bằng Chrome</h4>
                    <p className="text-sm text-muted-foreground">
                      Đảm bảo bạn đang mở trang web này bằng trình duyệt <strong>Chrome</strong>
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      2
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h4 className="font-medium mb-1 flex items-center gap-2">
                      Nhấn vào menu
                      <MoreVertical className="h-4 w-4 text-primary" />
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Nhấn vào biểu tượng <strong>3 chấm dọc</strong> ở góc trên bên phải màn hình
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      3
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h4 className="font-medium mb-1 flex items-center gap-2">
                      Chọn "Cài đặt ứng dụng"
                      <Download className="h-4 w-4 text-primary" />
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Chọn <strong>"Cài đặt ứng dụng"</strong> hoặc <strong>"Thêm vào màn hình chính"</strong>
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      4
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h4 className="font-medium mb-1">Xác nhận cài đặt</h4>
                    <p className="text-sm text-muted-foreground">
                      Nhấn <strong>"Cài đặt"</strong> trong hộp thoại xác nhận
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-100">
                <div className="flex gap-3">
                  <Home className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Sau khi hoàn tất</p>
                    <p className="text-sm text-green-600">
                      Ứng dụng vkho.vn sẽ được cài đặt và xuất hiện trong danh sách ứng dụng của bạn!
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Lợi ích khi cài đặt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Truy cập nhanh</h4>
                <p className="text-xs text-muted-foreground">Mở app chỉ với 1 chạm từ màn hình chính</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Không cần tải về</h4>
                <p className="text-xs text-muted-foreground">Cài đặt trực tiếp, không qua App Store</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ArrowRight className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Tự động cập nhật</h4>
                <p className="text-xs text-muted-foreground">Luôn có phiên bản mới nhất</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Hoạt động offline</h4>
                <p className="text-xs text-muted-foreground">Một số tính năng vẫn hoạt động khi mất mạng</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
