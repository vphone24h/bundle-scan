import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe, ExternalLink } from 'lucide-react';
import { usePopupPriority } from '@/hooks/usePopupPriority';
import { useCustomDomains } from '@/hooks/useCustomDomains';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useCustomDomainArticlePublic } from '@/hooks/useAppConfig';
import { sanitizeCustomDomainArticle } from '@/lib/customDomainArticle';

interface Props {
  isEnabled: boolean;
}

export function CustomDomainPopup({ isEnabled }: Props) {
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const { activeLayer, claim, release } = usePopupPriority();
  const { data: customDomains } = useCustomDomains();
  const { data: tenant } = useCurrentTenant();
  const { data: article } = useCustomDomainArticlePublic();

  const isDomainDataReady = customDomains !== undefined;
  const verifiedDomain = customDomains?.find(d => d.is_verified && d.tenant_id === tenant?.id);
  const hasCustomDomain = !!verifiedDomain;

  const ADMIN_PHONE = '0355820185';
  const ADMIN_PHONE_DISPLAY = '0355 820 185';
  const ZALO_URL = `https://zalo.me/${ADMIN_PHONE}`;

  const shouldShow = useCallback(() => {
    if (!isEnabled || !tenant?.id || !isDomainDataReady || hasCustomDomain) return false;
    return true;
  }, [isEnabled, tenant?.id, isDomainDataReady, hasCustomDomain]);

  useEffect(() => {
    if (!shouldShow()) return;

    // Wait a bit for higher-priority popups to claim first
    const timer = setTimeout(() => {
      if (shouldShow()) {
        const granted = claim('domain');
        if (granted) setOpen(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [shouldShow, claim]);

  // If a higher-priority popup takes over, close this one
  useEffect(() => {
    if (open && activeLayer !== 'domain') {
      setOpen(false);
    }
  }, [open, activeLayer]);

  const handleClose = () => {
    setOpen(false);
    release('domain');
  };

  const handleViewDetail = () => {
    setOpen(false);
    release('domain');
    setDetailOpen(true);
  };

  return (
    <>
      {/* Main CTA popup */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="rounded-full bg-primary/15 p-4">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold">🌐 Sở hữu tên miền riêng!</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Biến website thành <span className="font-semibold text-foreground">thương hiệu riêng</span> của bạn với tên miền như <span className="font-medium text-primary">cuahang.vn</span> — chuyên nghiệp &amp; dễ nhớ hơn!
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button onClick={handleViewDetail} className="w-full gap-1.5">
                Xem chi tiết
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">
                Để sau
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog (same as B3 CustomDomainCTA detail) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Dịch vụ tên miền riêng
            </DialogTitle>
          </DialogHeader>
          {article ? (
            <div
              className="prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeCustomDomainArticle(article) }}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <p>Sở hữu tên miền riêng cho website của bạn</p>
              <p>Ví dụ: cửa hàng của bạn là Apple Táo</p>
              <p>👉 Bạn có thể sử dụng tên miền riêng như: appletao.com</p>
              <p>Việc dùng tên miền riêng giúp:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Khách hàng truy cập trực tiếp website của bạn</li>
                <li>Không phụ thuộc vào tên miền vkho</li>
                <li>Tăng độ chuyên nghiệp &amp; nhận diện thương hiệu</li>
              </ul>
              <p>📌 Tên miền do bạn tự chọn, theo đúng tên thương hiệu của mình.</p>
            </div>
          )}
          <div className="rounded-lg border bg-muted/50 p-4 mt-3 space-y-3">
            <p className="text-sm font-medium">👉 Để kích hoạt tính năng, vui lòng liên hệ Admin:</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={`tel:${ADMIN_PHONE}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-background hover:bg-accent transition-colors text-sm font-medium"
              >
                📞 {ADMIN_PHONE_DISPLAY}
              </a>
              <a
                href={ZALO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-background hover:bg-accent transition-colors text-sm font-medium"
              >
                💬 Nhắn Zalo
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
