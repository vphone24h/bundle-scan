import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useUpdateMinigameCampaign, MinigameCampaign } from '@/hooks/useMinigame';
import { Loader2, Save } from 'lucide-react';

interface MinigameConfigTabProps {
  campaign: MinigameCampaign;
}

export function MinigameConfigTab({ campaign }: MinigameConfigTabProps) {
  const updateCampaign = useUpdateMinigameCampaign();
  
  // Basic info
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description || '');
  
  // Wheel colors
  const [wheelBgColor, setWheelBgColor] = useState(campaign.wheel_background_color || '#FFD700');
  const [wheelBorderColor, setWheelBorderColor] = useState(campaign.wheel_border_color || '#FF6B00');
  
  // Prize display
  const [prizeFontSize, setPrizeFontSize] = useState(13);
  const [prizeTextColor, setPrizeTextColor] = useState('#FFFFFF');
  const [prizeUseImage, setPrizeUseImage] = useState(false);
  const [prizeImageSize, setPrizeImageSize] = useState(55);
  
  // Spin button
  const [spinButtonText, setSpinButtonText] = useState(campaign.spin_button_text || 'QUAY NGAY');
  const [spinButtonColor, setSpinButtonColor] = useState(campaign.spin_button_color || '#FF4500');
  const [maxSpins, setMaxSpins] = useState(campaign.max_spins_per_player || 1);
  
  // No prize
  const [noPrizeTitle, setNoPrizeTitle] = useState(campaign.no_prize_message || 'Chúc bạn may mắn lần sau!');
  
  // Password
  const [password, setPassword] = useState(campaign.password || '');
  
  // Sponsor
  const [sponsorName, setSponsorName] = useState(campaign.sponsor_name || '');
  
  // Special config
  const [allowDuplicatePrize, setAllowDuplicatePrize] = useState(false);
  const [allowMultiplePrizes, setAllowMultiplePrizes] = useState(false);
  const [autoGeneratePrizeCode, setAutoGeneratePrizeCode] = useState(true);
  const [sendWinnerNotification, setSendWinnerNotification] = useState(false);
  const [continueButtonText, setContinueButtonText] = useState('Tiếp tục');
  const [winTitle, setWinTitle] = useState('Bạn đã trúng thưởng:');
  const [infoGuideText, setInfoGuideText] = useState('Vui lòng điền chính xác thông tin bên dưới để nhận giải thưởng cuối mini game');

  const handleSave = async () => {
    await updateCampaign.mutateAsync({
      id: campaign.id,
      name,
      description,
      wheel_background_color: wheelBgColor,
      wheel_border_color: wheelBorderColor,
      spin_button_text: spinButtonText,
      spin_button_color: spinButtonColor,
      max_spins_per_player: maxSpins,
      no_prize_message: noPrizeTitle,
      password: password || undefined,
      sponsor_name: sponsorName || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="bg-primary text-primary-foreground py-3 px-4 rounded-t-lg">
          <span className="font-medium">Cấu hình</span>
        </CardHeader>
        <CardContent className="p-0">
          <Accordion type="multiple" defaultValue={['basic']} className="w-full">
            {/* Thông tin cơ bản */}
            <AccordionItem value="basic" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                Thông tin cơ bản
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label>Tên dự án</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Mô tả</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Hình nền */}
            <AccordionItem value="background" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                Hình nền
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <p className="text-sm text-muted-foreground">Tải lên hình nền cho vòng quay (tính năng sẽ được bổ sung)</p>
              </AccordionContent>
            </AccordionItem>

            {/* Khung quay */}
            <AccordionItem value="wheel-frame" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                Khung quay
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Màu nền vòng quay</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={wheelBgColor}
                        onChange={(e) => setWheelBgColor(e.target.value)}
                        className="w-14 h-10 p-1"
                      />
                      <Input value={wheelBgColor} onChange={(e) => setWheelBgColor(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Màu viền</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={wheelBorderColor}
                        onChange={(e) => setWheelBorderColor(e.target.value)}
                        className="w-14 h-10 p-1"
                      />
                      <Input value={wheelBorderColor} onChange={(e) => setWheelBorderColor(e.target.value)} />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Giải thưởng */}
            <AccordionItem value="prize-display" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                Giải thưởng
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Cỡ chữ ({prizeFontSize})</Label>
                  <Slider
                    value={[prizeFontSize]}
                    onValueChange={(v) => setPrizeFontSize(v[0])}
                    min={8}
                    max={24}
                    step={1}
                    className="w-48"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Màu chữ</Label>
                  <Input
                    type="color"
                    value={prizeTextColor}
                    onChange={(e) => setPrizeTextColor(e.target.value)}
                    className="w-20 h-8 p-1"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Dùng hình ảnh</Label>
                  <Switch checked={prizeUseImage} onCheckedChange={setPrizeUseImage} />
                </div>
                {prizeUseImage && (
                  <div className="flex items-center justify-between">
                    <Label>Kích thước hình ({prizeImageSize})</Label>
                    <Slider
                      value={[prizeImageSize]}
                      onValueChange={(v) => setPrizeImageSize(v[0])}
                      min={20}
                      max={100}
                      step={5}
                      className="w-48"
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Nút xoay & Lượt quay */}
            <AccordionItem value="spin-button" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                Nút xoay & Lượt quay
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Chữ trên nút quay</Label>
                    <Input value={spinButtonText} onChange={(e) => setSpinButtonText(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Màu nút quay</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={spinButtonColor}
                        onChange={(e) => setSpinButtonColor(e.target.value)}
                        className="w-14 h-10 p-1"
                      />
                      <Input value={spinButtonColor} onChange={(e) => setSpinButtonColor(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Số lượt quay tối đa mỗi người</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxSpins}
                    onChange={(e) => setMaxSpins(Number(e.target.value))}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Không trúng thưởng */}
            <AccordionItem value="no-prize" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                Không trúng thưởng
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label>Tiêu đề</Label>
                  <Input value={noPrizeTitle} onChange={(e) => setNoPrizeTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hình ảnh</Label>
                  <p className="text-sm text-muted-foreground">Tải lên hình ảnh (tính năng sẽ được bổ sung)</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Mật khẩu */}
            <AccordionItem value="password" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                Mật khẩu
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label>Mật khẩu bảo vệ (tùy chọn)</Label>
                  <Input
                    type="password"
                    placeholder="Để trống nếu không cần mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Nhà tài trợ */}
            <AccordionItem value="sponsor" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                Nhà tài trợ
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label>Đơn vị tài trợ</Label>
                  <Textarea
                    placeholder="Nhập thông tin nhà tài trợ..."
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    rows={4}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Cấu hình đặc biệt */}
            <AccordionItem value="special-config" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                Cấu hình đặc biệt
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Trúng trùng giải thưởng</Label>
                  <Switch checked={allowDuplicatePrize} onCheckedChange={setAllowDuplicatePrize} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Cho phép nhận nhiều giải thưởng</Label>
                  <Switch checked={allowMultiplePrizes} onCheckedChange={setAllowMultiplePrizes} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Tự động tạo mã nhận thưởng</Label>
                  <Switch checked={autoGeneratePrizeCode} onCheckedChange={setAutoGeneratePrizeCode} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Gửi thông báo trúng thưởng cho khách</Label>
                  <Switch checked={sendWinnerNotification} onCheckedChange={setSendWinnerNotification} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tiêu đề nút xoay</Label>
                    <Input value={spinButtonText} onChange={(e) => setSpinButtonText(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tiêu đề nút tiếp tục</Label>
                    <Input value={continueButtonText} onChange={(e) => setContinueButtonText(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tiêu đề trúng thưởng</Label>
                  <Textarea value={winTitle} onChange={(e) => setWinTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hướng dẫn nhập thông tin</Label>
                  <Input value={infoGuideText} onChange={(e) => setInfoGuideText(e.target.value)} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={handleSave} disabled={updateCampaign.isPending}>
          {updateCampaign.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Lưu cấu hình
        </Button>
      </div>
    </div>
  );
}
