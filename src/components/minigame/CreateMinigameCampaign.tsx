import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCreateMinigameCampaign, useCreateMinigamePrize } from '@/hooks/useMinigame';
import { ArrowLeft, Loader2, Plus, Trash2, Gift, Settings, Rocket } from 'lucide-react';

// Predefined background colors for wheel segments
const SEGMENT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

interface PrizeInput {
  name: string;
  probability: number;
  color: string;
  total_quantity?: number;
}

export default function CreateMinigameCampaign() {
  const navigate = useNavigate();
  const createCampaign = useCreateMinigameCampaign();
  const createPrize = useCreateMinigamePrize();

  const [activeStep, setActiveStep] = useState('config');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campaign data
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxSpinsPerPlayer, setMaxSpinsPerPlayer] = useState(1);
  const [requireName, setRequireName] = useState(true);
  const [requirePhone, setRequirePhone] = useState(true);
  const [requireEmail, setRequireEmail] = useState(false);
  const [password, setPassword] = useState('');
  const [noPrizeMessage, setNoPrizeMessage] = useState('Chúc bạn may mắn lần sau!');
  const [noPrizeProbability, setNoPrizeProbability] = useState(30);
  const [sponsorName, setSponsorName] = useState('');
  const [wheelBackgroundColor, setWheelBackgroundColor] = useState('#FFD700');
  const [wheelBorderColor, setWheelBorderColor] = useState('#FF6B00');
  const [spinButtonText, setSpinButtonText] = useState('QUAY NGAY');
  const [spinButtonColor, setSpinButtonColor] = useState('#FF4500');

  // Prizes
  const [prizes, setPrizes] = useState<PrizeInput[]>([
    { name: 'Giải nhất', probability: 5, color: SEGMENT_COLORS[0] },
    { name: 'Giải nhì', probability: 10, color: SEGMENT_COLORS[1] },
    { name: 'Giải ba', probability: 15, color: SEGMENT_COLORS[2] },
    { name: 'Giải khuyến khích', probability: 40, color: SEGMENT_COLORS[3] },
  ]);

  const addPrize = () => {
    setPrizes([
      ...prizes,
      {
        name: `Giải ${prizes.length + 1}`,
        probability: 10,
        color: SEGMENT_COLORS[prizes.length % SEGMENT_COLORS.length],
      },
    ]);
  };

  const updatePrize = (index: number, field: keyof PrizeInput, value: any) => {
    const updated = [...prizes];
    updated[index] = { ...updated[index], [field]: value };
    setPrizes(updated);
  };

  const removePrize = (index: number) => {
    setPrizes(prizes.filter((_, i) => i !== index));
  };

  const totalProbability = prizes.reduce((sum, p) => sum + p.probability, 0) + noPrizeProbability;

  const handleSubmit = async () => {
    if (!name.trim()) {
      return;
    }

    if (totalProbability !== 100) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Create campaign
      const campaign = await createCampaign.mutateAsync({
        name,
        description,
        max_spins_per_player: maxSpinsPerPlayer,
        require_name: requireName,
        require_phone: requirePhone,
        require_email: requireEmail,
        password: password || undefined,
        no_prize_message: noPrizeMessage,
        no_prize_probability: noPrizeProbability,
        sponsor_name: sponsorName || undefined,
        wheel_background_color: wheelBackgroundColor,
        wheel_border_color: wheelBorderColor,
        spin_button_text: spinButtonText,
        spin_button_color: spinButtonColor,
        status: 'draft',
      });

      // Create prizes
      for (let i = 0; i < prizes.length; i++) {
        await createPrize.mutateAsync({
          campaign_id: campaign.id,
          name: prizes[i].name,
          probability: prizes[i].probability,
          color: prizes[i].color,
          total_quantity: prizes[i].total_quantity,
          remaining_quantity: prizes[i].total_quantity,
          display_order: i,
        });
      }

      navigate(`/minigame/${campaign.id}/settings`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader title="Tạo dự án Mini Game mới" />

      <div className="p-4 sm:p-6">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/minigame')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Quay lại
        </Button>

        <Tabs value={activeStep} onValueChange={setActiveStep}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Bước 1:</span> Cấu hình
            </TabsTrigger>
            <TabsTrigger value="prizes" className="flex items-center gap-1">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Bước 2:</span> Giải thưởng
            </TabsTrigger>
            <TabsTrigger value="publish" className="flex items-center gap-1">
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Bước 3:</span> Xuất bản
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Configuration */}
          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Thông tin cơ bản</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên dự án *</Label>
                  <Input
                    id="name"
                    placeholder="VD: Quay số may mắn tháng 1/2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Mô tả</Label>
                  <Textarea
                    id="description"
                    placeholder="Mô tả ngắn về chương trình..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quy tắc tham gia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxSpins">Số lượt quay tối đa mỗi người</Label>
                  <Input
                    id="maxSpins"
                    type="number"
                    min={1}
                    value={maxSpinsPerPlayer}
                    onChange={(e) => setMaxSpinsPerPlayer(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireName">Yêu cầu nhập họ tên</Label>
                  <Switch id="requireName" checked={requireName} onCheckedChange={setRequireName} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requirePhone">Yêu cầu nhập số điện thoại</Label>
                  <Switch id="requirePhone" checked={requirePhone} onCheckedChange={setRequirePhone} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireEmail">Yêu cầu nhập email</Label>
                  <Switch id="requireEmail" checked={requireEmail} onCheckedChange={setRequireEmail} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu bảo vệ (tùy chọn)</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Để trống nếu không cần mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tùy chỉnh giao diện</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Màu nền vòng quay</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={wheelBackgroundColor}
                        onChange={(e) => setWheelBackgroundColor(e.target.value)}
                        className="w-14 h-10 p-1"
                      />
                      <Input
                        value={wheelBackgroundColor}
                        onChange={(e) => setWheelBackgroundColor(e.target.value)}
                        className="flex-1"
                      />
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
                      <Input
                        value={wheelBorderColor}
                        onChange={(e) => setWheelBorderColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Màu nút quay</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={spinButtonColor}
                        onChange={(e) => setSpinButtonColor(e.target.value)}
                        className="w-14 h-10 p-1"
                      />
                      <Input
                        value={spinButtonColor}
                        onChange={(e) => setSpinButtonColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Chữ trên nút quay</Label>
                    <Input
                      value={spinButtonText}
                      onChange={(e) => setSpinButtonText(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nhà tài trợ (tùy chọn)</Label>
                  <Input
                    placeholder="Tên nhà tài trợ..."
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setActiveStep('prizes')}>
                Tiếp tục: Giải thưởng →
              </Button>
            </div>
          </TabsContent>

          {/* Step 2: Prizes */}
          <TabsContent value="prizes" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Danh sách giải thưởng</CardTitle>
                <Button onClick={addPrize} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Thêm giải
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {prizes.map((prize, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Input
                      type="color"
                      value={prize.color}
                      onChange={(e) => updatePrize(index, 'color', e.target.value)}
                      className="w-10 h-10 p-1"
                    />
                    <Input
                      placeholder="Tên giải thưởng"
                      value={prize.name}
                      onChange={(e) => updatePrize(index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1 w-24">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={prize.probability}
                        onChange={(e) => updatePrize(index, 'probability', Number(e.target.value))}
                        className="w-16"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      placeholder="SL"
                      value={prize.total_quantity || ''}
                      onChange={(e) => updatePrize(index, 'total_quantity', Number(e.target.value) || undefined)}
                      className="w-20"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePrize(index)}
                      disabled={prizes.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                {/* No Prize */}
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded bg-gray-400 flex items-center justify-center text-white text-xs">
                    X
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Không trúng thưởng</p>
                    <Input
                      placeholder="Thông báo khi không trúng"
                      value={noPrizeMessage}
                      onChange={(e) => setNoPrizeMessage(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-1 w-24">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={noPrizeProbability}
                      onChange={(e) => setNoPrizeProbability(Number(e.target.value))}
                      className="w-16"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="w-20" />
                  <div className="w-10" />
                </div>

                {/* Total */}
                <div className={`text-right text-sm ${totalProbability === 100 ? 'text-green-600' : 'text-red-600'}`}>
                  Tổng xác suất: {totalProbability}% {totalProbability !== 100 && '(phải bằng 100%)'}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveStep('config')}>
                ← Quay lại
              </Button>
              <Button onClick={() => setActiveStep('publish')} disabled={totalProbability !== 100}>
                Tiếp tục: Xuất bản →
              </Button>
            </div>
          </TabsContent>

          {/* Step 3: Publish */}
          <TabsContent value="publish" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Xem lại thông tin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tên dự án:</span>
                    <p className="font-medium">{name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Số lượt quay/người:</span>
                    <p className="font-medium">{maxSpinsPerPlayer}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Yêu cầu thông tin:</span>
                    <p className="font-medium">
                      {[requireName && 'Họ tên', requirePhone && 'SĐT', requireEmail && 'Email']
                        .filter(Boolean)
                        .join(', ') || 'Không yêu cầu'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Số giải thưởng:</span>
                    <p className="font-medium">{prizes.length} giải</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2">Giải thưởng:</p>
                  <div className="space-y-1">
                    {prizes.map((prize, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: prize.color }}
                        />
                        <span>{prize.name}</span>
                        <span className="text-muted-foreground">({prize.probability}%)</span>
                        {prize.total_quantity && (
                          <span className="text-muted-foreground">- SL: {prize.total_quantity}</span>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-gray-400" />
                      <span>Không trúng</span>
                      <span className="text-muted-foreground">({noPrizeProbability}%)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveStep('prizes')}>
                ← Quay lại
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim() || totalProbability !== 100}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-1" />
                    Tạo dự án
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
