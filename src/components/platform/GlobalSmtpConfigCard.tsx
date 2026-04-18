import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, KeyRound, Info, ExternalLink } from 'lucide-react';

/**
 * Global SMTP Config (Platform-wide fallback).
 * Stored as Lovable Cloud secrets: SMTP_USER, SMTP_PASSWORD.
 * Used when a company has no `company_email_config` enabled.
 */
export function GlobalSmtpConfigCard() {
  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-amber-700" />
          Cấu hình Email gốc (Platform fallback)
        </CardTitle>
        <CardDescription>
          Email Gmail dùng làm <strong>fallback toàn nền tảng</strong> khi công ty chưa cấu hình SMTP riêng (vd: gửi mail khôi phục mật khẩu, thông báo hệ thống).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-background border space-y-2 text-sm">
          <p className="font-medium flex items-center gap-1.5">
            <Info className="h-4 w-4 text-blue-600" />
            Cách cập nhật khi Gmail bị Google khóa
          </p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-1 text-xs">
            <li>Tạo Gmail mới (hoặc dùng Gmail khác đã có).</li>
            <li>Bật <strong>Xác minh 2 bước</strong> tại Google Account → Bảo mật.</li>
            <li>Vào <strong>Mật khẩu ứng dụng</strong> → tạo mật khẩu cho "Mail" (16 ký tự).</li>
            <li>Bấm 2 nút bên dưới để cập nhật <code className="bg-muted px-1 rounded">SMTP_USER</code> và <code className="bg-muted px-1 rounded">SMTP_PASSWORD</code>.</li>
          </ol>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              // Trigger Lovable secrets dialog via custom event
              window.dispatchEvent(new CustomEvent('lovable:open-secrets', { detail: { names: ['SMTP_USER'] } }));
            }}
          >
            <Mail className="h-4 w-4 mr-2" />
            Cập nhật Email gốc (SMTP_USER)
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('lovable:open-secrets', { detail: { names: ['SMTP_PASSWORD'] } }));
            }}
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Cập nhật App Password (SMTP_PASSWORD)
          </Button>
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          Sau khi cập nhật, hệ thống sẽ tự dùng email mới ngay lập tức cho tất cả các thông báo gốc. Các công ty đã có SMTP riêng (cấu hình trong Cài đặt công ty) vẫn dùng email riêng của họ.
        </p>

        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Mở trang tạo App Password của Google
        </a>
      </CardContent>
    </Card>
  );
}
