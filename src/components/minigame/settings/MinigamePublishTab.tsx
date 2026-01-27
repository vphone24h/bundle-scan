import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateMinigameCampaign, MinigameCampaign } from '@/hooks/useMinigame';
import { Loader2, Save, ExternalLink, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MinigamePublishTabProps {
  campaign: MinigameCampaign;
}

export function MinigamePublishTab({ campaign }: MinigamePublishTabProps) {
  const { toast } = useToast();
  const updateCampaign = useUpdateMinigameCampaign();
  
  // Status & Link
  const [status, setStatus] = useState(campaign.status);
  const playLink = `${window.location.origin}/play/${campaign.id}`;
  
  // Spin settings
  const [maxSpins, setMaxSpins] = useState(campaign.max_spins_per_player || 1);
  const [resetSpinsDaily, setResetSpinsDaily] = useState(false);
  const [requireInfoEachSpin, setRequireInfoEachSpin] = useState(false);
  
  // Prize code settings
  const [prizeCodePrefix, setPrizeCodePrefix] = useState('1/2026');
  const [showPrizeCodeSuffix, setShowPrizeCodeSuffix] = useState(true);
  
  // Verification
  const [verificationMethod, setVerificationMethod] = useState('name_phone');
  const [requirePrizeInfo, setRequirePrizeInfo] = useState(true);
  const [claimMethod, setClaimMethod] = useState('email');
  
  // Dates
  const [expireDate, setExpireDate] = useState('');
  
  // Project info
  const [projectTitle, setProjectTitle] = useState(campaign.name);
  const [projectDescription, setProjectDescription] = useState(campaign.description || '');
  
  // Share settings
  const [shareQuote, setShareQuote] = useState('Cùng quay số Trúng Thưởng 100% có quà nè mấy bạn vào thử đi');
  const [shareHashtag, setShareHashtag] = useState('#VPhone24h');
  
  // Email template
  const [winnerEmailTemplate, setWinnerEmailTemplate] = useState(`Chào {Nguoi_Choi}!
- Bạn vừa trúng giải {Giai_Thuong} của game {Ten_Game} tại Mini Game: {Link_Game}
- Mã nhận thưởng của bạn là: {Ma_Nhan_Thuong}`);
  
  // Special features
  const [enableFacebookComments, setEnableFacebookComments] = useState(false);
  const [createVirtualWinners, setCreateVirtualWinners] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(playLink);
    toast({
      title: 'Đã sao chép',
      description: 'Link dự án đã được sao chép vào clipboard',
    });
  };

  const handleSave = async () => {
    await updateCampaign.mutateAsync({
      id: campaign.id,
      status,
      max_spins_per_player: maxSpins,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-primary text-primary-foreground py-3 px-4 rounded-t-lg">
          <span className="font-medium">Xuất bản dự án</span>
        </CardHeader>
        <CardContent className="p-4 space-y-6">
          {/* Status & Link */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <div className="flex items-center gap-2">
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Bản nháp</SelectItem>
                    <SelectItem value="active">Xuất bản</SelectItem>
                    <SelectItem value="paused">Tạm dừng</SelectItem>
                    <SelectItem value="expired">Hết hạn</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  (Chọn trạng thái là <strong>XUẤT BẢN</strong> để người chơi có thể truy cập vào dự án của bạn)
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Link dự án</Label>
            <div className="flex gap-2">
              <Input value={playLink} readOnly className="flex-1" />
              <Button variant="outline" size="icon" onClick={handleCopyLink}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => window.open(playLink, '_blank')}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Spin settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Số lượt chơi cho mỗi người chơi:</Label>
              <Input
                type="number"
                min={1}
                value={maxSpins}
                onChange={(e) => setMaxSpins(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">(Thay đổi này chỉ có hiệu lực với người chơi mới hoặc khi qua ngày mới)</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Làm mới số lượt chơi mỗi ngày:</Label>
            <Switch checked={resetSpinsDaily} onCheckedChange={setResetSpinsDaily} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Nhập lại thông tin sau mỗi lượt chơi:</Label>
              <p className="text-xs text-muted-foreground">(Người chơi sẽ cần nhập thông tin cho mỗi lượt chơi)</p>
            </div>
            <Switch checked={requireInfoEachSpin} onCheckedChange={setRequireInfoEachSpin} />
          </div>

          {/* Prize code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Tiền tố mã nhận thưởng:</Label>
              <Input
                value={prizeCodePrefix}
                onChange={(e) => setPrizeCodePrefix(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Hiển thị hậu tố mã nhận thưởng:</Label>
              <Switch checked={showPrizeCodeSuffix} onCheckedChange={setShowPrizeCodeSuffix} />
            </div>
          </div>

          {showPrizeCodeSuffix && (
            <p className="text-sm text-muted-foreground">( Ví dụ: {prizeCodePrefix}-12345ABCDEF )</p>
          )}

          {/* Verification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Xác thực người chơi:</Label>
              <Select value={verificationMethod} onValueChange={setVerificationMethod}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_phone">Nhập tên và số điện thoại</SelectItem>
                  <SelectItem value="phone">Chỉ nhập số điện thoại</SelectItem>
                  <SelectItem value="email">Nhập email</SelectItem>
                  <SelectItem value="none">Không yêu cầu</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">(Tính năng này không áp dụng cho tài khoản dùng thử)</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Nhập thông tin nhận thưởng:</Label>
              <p className="text-xs text-muted-foreground">(Bao gồm: Ngày sinh, giới tính, tỉnh thành)</p>
            </div>
            <Switch checked={requirePrizeInfo} onCheckedChange={setRequirePrizeInfo} />
          </div>

          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap">Hình thức nhận thưởng:</Label>
            <Select value={claimMethod} onValueChange={setClaimMethod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Nhập email</SelectItem>
                <SelectItem value="phone">Nhập số điện thoại</SelectItem>
                <SelectItem value="address">Nhập địa chỉ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expire date */}
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap">Ngày hết hạn:</Label>
            <Input
              type="date"
              value={expireDate}
              onChange={(e) => setExpireDate(e.target.value)}
              className="w-48"
            />
          </div>

          {/* Project info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tiêu đề dự án:</Label>
              <Input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="VD: QUAY SỐ MAY MẮN THÁNG 10"
              />
            </div>

            <div className="space-y-2">
              <Label>Mô tả dự án:</Label>
              <Textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={4}
                placeholder="Mô tả chi tiết về chương trình..."
              />
            </div>

            <div className="space-y-2">
              <Label>Ảnh đại diện của dự án:</Label>
              <Button variant="outline" size="sm">Chọn ảnh</Button>
            </div>
          </div>

          {/* Share settings */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Nội dung trích dẫn khi share:</Label>
              <Input
                value={shareQuote}
                onChange={(e) => setShareQuote(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                *** Tham số:
                <ul className="list-disc list-inside ml-2">
                  <li><strong>{'{Giai_Thuong}'}</strong>: Tên giải thưởng người chơi đã trúng</li>
                  <li><strong>{'{Ten_Game}'}</strong>: Tên dự án của bạn</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Hashtag khi share:</Label>
              <Input
                value={shareHashtag}
                onChange={(e) => setShareHashtag(e.target.value)}
                className="w-48"
              />
            </div>
          </div>

          {/* Email template */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Nội dung email gửi người trúng thưởng:</Label>
              <div className="flex gap-2 mb-2">
                <Button variant="outline" size="sm">Mặc định</Button>
                <Button variant="outline" size="sm">Mẫu nhận thưởng Công Ty</Button>
              </div>
              <Textarea
                value={winnerEmailTemplate}
                onChange={(e) => setWinnerEmailTemplate(e.target.value)}
                rows={6}
              />
              <div className="text-xs text-muted-foreground">
                *** Tham số:
                <ul className="list-disc list-inside ml-2 grid grid-cols-2 gap-1">
                  <li><strong>{'{Ten_Game}'}</strong>: Tên dự án của bạn</li>
                  <li><strong>{'{Link_Game}'}</strong>: Liên kết chơi dự án</li>
                  <li><strong>{'{Giai_Thuong}'}</strong>: Tên giải thưởng người chơi đã trúng</li>
                  <li><strong>{'{Nguoi_Choi}'}</strong>: Tên của người chơi</li>
                  <li><strong>{'{Ma_Nhan_Thuong}'}</strong>: Mã nhận thưởng của người chơi</li>
                  <li><strong>{'{So_Dien_Thoai}'}</strong>: Số điện thoại của người chơi</li>
                  <li><strong>{'{Mo_Ta_Giai_Thuong}'}</strong>: Thông tin giới thiệu của giải thưởng</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Special features */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Bình luận Facebook:</Label>
              <Switch checked={enableFacebookComments} onCheckedChange={setEnableFacebookComments} />
            </div>

            <div className="flex items-center justify-between">
              <Label>Tạo người trúng thưởng ảo:</Label>
              <Switch checked={createVirtualWinners} onCheckedChange={setCreateVirtualWinners} />
            </div>

            <div className="space-y-2">
              <Label>URL Webhook:</Label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-destructive">
                (Tính năng này KHÔNG áp dụng cho tài khoản dùng thử hoặc gói sử dụng hết hạn, KHÔNG hoạt động với tính năng không xác thực người chơi)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Link tự điền khi người chơi được cấp link riêng:</Label>
              <div className="text-xs text-muted-foreground">
                <ul className="list-disc list-inside">
                  <li><strong>{'{phone}'}</strong>: Số điện thoại</li>
                  <li><strong>{'{fullname}'}</strong>: Họ tên</li>
                </ul>
              </div>
              <p className="text-sm text-primary">
                Mẫu link: {playLink}?phone={'{phone}'}&fullname={'{fullname}'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={handleSave} disabled={updateCampaign.isPending}>
          {updateCampaign.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Lưu thay đổi
        </Button>
      </div>
    </div>
  );
}
