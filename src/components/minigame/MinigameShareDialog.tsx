import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MinigameCampaign } from '@/hooks/useMinigame';
import { Copy, Download, QrCode } from 'lucide-react';

interface MinigameShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: MinigameCampaign | null;
}

export function MinigameShareDialog({ open, onOpenChange, campaign }: MinigameShareDialogProps) {
  const { toast } = useToast();

  if (!campaign) return null;

  // Generate play URL based on campaign ID
  const baseUrl = window.location.origin;
  const playUrl = `${baseUrl}/play/${campaign.id}`;
  const embedCode = `<iframe src="${playUrl}" frameborder="0" style="width:100%;height:650px;border:none;border-radius:15px"></iframe>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Đã sao chép',
      description: `${label} đã được sao chép vào clipboard`,
    });
  };

  const generateQRCode = () => {
    // Using QR code API
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(playUrl)}`;
  };

  const downloadQRCode = async () => {
    const qrUrl = generateQRCode();
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${campaign.name.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Thành công',
        description: 'Đã tải xuống mã QR',
      });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tải xuống mã QR',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chia sẻ dự án</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* QR Code */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Mã QR dùng in dán lên banner hoặc cửa hàng
            </p>
            <div className="flex justify-center">
              <div className="border rounded-lg p-4 bg-white">
                <img
                  src={generateQRCode()}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>
            <Button variant="default" className="mt-3" onClick={downloadQRCode}>
              <Download className="h-4 w-4 mr-2" />
              Tải xuống mã QR
            </Button>
          </div>

          {/* Direct Link */}
          <div className="space-y-2">
            <Label>Link chia sẻ trực tiếp</Label>
            <div className="flex gap-2">
              <Input value={playUrl} readOnly className="flex-1 text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(playUrl, 'Link')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Embed Code */}
          <div className="space-y-2">
            <Label>Mã nhúng vào website có sẵn</Label>
            <div className="relative">
              <Textarea
                value={embedCode}
                readOnly
                rows={4}
                className="text-xs font-mono pr-12"
              />
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 bottom-2"
                onClick={() => copyToClipboard(embedCode, 'Mã nhúng')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Copy và dán mã này vào khu vực muốn hiển thị trên Website của bạn.
            </p>
          </div>

          {/* Popup Embed */}
          <div className="space-y-2">
            <Label>Mã nhúng vào website dạng popup</Label>
            <Button
              variant="default"
              className="w-full"
              onClick={() => {
                const popupCode = `
<script>
  (function() {
    var popup = document.createElement('div');
    popup.innerHTML = '<div style="position:fixed;bottom:20px;right:20px;z-index:9999;"><button onclick="document.getElementById(\\'minigame-popup\\').style.display=\\'flex\\'" style="background:#FF4500;color:white;border:none;padding:15px 25px;border-radius:50px;cursor:pointer;font-weight:bold;box-shadow:0 4px 15px rgba(0,0,0,0.2);">🎁 Quay may mắn</button></div><div id="minigame-popup" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;align-items:center;justify-content:center;"><div style="background:white;border-radius:15px;max-width:400px;width:95%;max-height:90vh;overflow:hidden;position:relative;"><button onclick="document.getElementById(\\'minigame-popup\\').style.display=\\'none\\'" style="position:absolute;right:10px;top:10px;border:none;background:none;font-size:24px;cursor:pointer;">×</button><iframe src="${playUrl}" style="width:100%;height:600px;border:none;"></iframe></div></div>';
    document.body.appendChild(popup);
  })();
</script>`;
                copyToClipboard(popupCode, 'Mã popup');
              }}
            >
              Lấy mã
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
