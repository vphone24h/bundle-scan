import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Gift, RotateCw, PartyPopper, Frown } from 'lucide-react';

interface Prize {
  id: string;
  name: string;
  color: string;
  probability: number;
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  require_name: boolean;
  require_phone: boolean;
  require_email: boolean;
  max_spins_per_player: number;
  no_prize_message: string;
  no_prize_probability: number;
  wheel_background_color: string;
  wheel_border_color: string;
  spin_button_text: string;
  spin_button_color: string;
  password?: string;
  sponsor_name?: string;
}

export default function PlayMinigame() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{ type: 'prize' | 'no_prize'; prize?: Prize } | null>(null);

  // Player form
  const [showForm, setShowForm] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [spinsRemaining, setSpinsRemaining] = useState(0);

  // Password protection
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');

  // Wheel animation
  const [rotation, setRotation] = useState(0);

  // Load campaign and prizes
  useEffect(() => {
    async function loadCampaign() {
      if (!id) return;

      setLoading(true);
      try {
        // Load campaign
        const { data: campaignData, error: campaignError } = await supabase
          .from('minigame_campaigns')
          .select('*')
          .eq('id', id)
          .eq('status', 'active')
          .single();

        if (campaignError || !campaignData) {
          toast({
            title: 'Lỗi',
            description: 'Không tìm thấy chương trình hoặc đã hết hạn',
            variant: 'destructive',
          });
          return;
        }

        setCampaign(campaignData as Campaign);

        // Check password protection
        if (campaignData.password) {
          setShowPasswordDialog(true);
        }

        // Load prizes
        const { data: prizesData } = await supabase
          .from('minigame_prizes')
          .select('id, name, color, probability')
          .eq('campaign_id', id)
          .eq('is_active', true)
          .order('display_order');

        setPrizes(prizesData as Prize[] || []);

        // Increment view count
        await supabase
          .from('minigame_campaigns')
          .update({ total_views: (campaignData.total_views || 0) + 1 })
          .eq('id', id);

      } catch (error) {
        console.error('Error loading campaign:', error);
      } finally {
        setLoading(false);
      }
    }

    loadCampaign();
  }, [id, toast]);

  // Draw wheel
  useEffect(() => {
    if (!canvasRef.current || prizes.length === 0 || !campaign) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 10;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Add no prize segment
    const allSegments = [
      ...prizes,
      { id: 'no_prize', name: 'Chúc may mắn', color: '#808080', probability: campaign.no_prize_probability }
    ];

    const totalProbability = allSegments.reduce((sum, p) => sum + p.probability, 0);
    let currentAngle = rotation * Math.PI / 180;

    // Draw segments
    allSegments.forEach((segment) => {
      const sliceAngle = (segment.probability / totalProbability) * 2 * Math.PI;
      
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();
      ctx.strokeStyle = campaign.wheel_border_color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(currentAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 2;
      ctx.fillText(segment.name.substring(0, 15), radius - 20, 5);
      ctx.restore();

      currentAngle += sliceAngle;
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(center, center, 25, 0, 2 * Math.PI);
    ctx.fillStyle = campaign.spin_button_color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(size - 5, center - 15);
    ctx.lineTo(size - 5, center + 15);
    ctx.lineTo(size - 35, center);
    ctx.closePath();
    ctx.fillStyle = campaign.spin_button_color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [prizes, campaign, rotation]);

  const handleSubmitPlayer = async () => {
    if (!campaign) return;

    if (campaign.require_name && !name.trim()) {
      toast({ title: 'Vui lòng nhập họ tên', variant: 'destructive' });
      return;
    }
    if (campaign.require_phone && !phone.trim()) {
      toast({ title: 'Vui lòng nhập số điện thoại', variant: 'destructive' });
      return;
    }
    if (campaign.require_email && !email.trim()) {
      toast({ title: 'Vui lòng nhập email', variant: 'destructive' });
      return;
    }

    try {
      // Check if participant exists
      const { data: existingParticipant } = await supabase
        .from('minigame_participants')
        .select('id, total_spins')
        .eq('campaign_id', campaign.id)
        .eq('phone', phone)
        .single();

      if (existingParticipant) {
        const remaining = campaign.max_spins_per_player - existingParticipant.total_spins;
        if (remaining <= 0) {
          toast({
            title: 'Đã hết lượt quay',
            description: 'Bạn đã sử dụng hết lượt quay cho chương trình này',
            variant: 'destructive',
          });
          return;
        }
        setParticipantId(existingParticipant.id);
        setSpinsRemaining(remaining);
      } else {
        // Create new participant
        const { data: newParticipant, error } = await supabase
          .from('minigame_participants')
          .insert({
            campaign_id: campaign.id,
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || null,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            toast({
              title: 'Số điện thoại đã được sử dụng',
              description: 'Vui lòng sử dụng số điện thoại khác',
              variant: 'destructive',
            });
          } else {
            throw error;
          }
          return;
        }

        setParticipantId(newParticipant.id);
        setSpinsRemaining(campaign.max_spins_per_player);

        // Update campaign stats
        await supabase
          .from('minigame_campaigns')
          .update({ total_participants: (campaign as any).total_participants + 1 })
          .eq('id', campaign.id);
      }

      setShowForm(false);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Có lỗi xảy ra',
        description: 'Vui lòng thử lại sau',
        variant: 'destructive',
      });
    }
  };

  const handleSpin = async () => {
    if (!campaign || !participantId || isSpinning || spinsRemaining <= 0) return;

    setIsSpinning(true);

    // Calculate result based on probability
    const allSegments = [
      ...prizes.map(p => ({ ...p, type: 'prize' as const })),
      { id: 'no_prize', name: campaign.no_prize_message, color: '#808080', probability: campaign.no_prize_probability, type: 'no_prize' as const }
    ];

    const totalProbability = allSegments.reduce((sum, p) => sum + p.probability, 0);
    let random = Math.random() * totalProbability;
    let selectedSegment = allSegments[0];

    for (const segment of allSegments) {
      random -= segment.probability;
      if (random <= 0) {
        selectedSegment = segment;
        break;
      }
    }

    // Calculate rotation to land on selected segment
    let cumulativeProbability = 0;
    for (const segment of allSegments) {
      if (segment.id === selectedSegment.id) {
        cumulativeProbability += segment.probability / 2;
        break;
      }
      cumulativeProbability += segment.probability;
    }

    const segmentAngle = (cumulativeProbability / totalProbability) * 360;
    const targetRotation = 360 * 5 + (360 - segmentAngle); // 5 full rotations + landing position

    // Animate rotation
    const startRotation = rotation;
    const duration = 4000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth slow down
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setRotation(startRotation + targetRotation * easeOut);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete - show result
        setIsSpinning(false);
        setSpinsRemaining(prev => prev - 1);

        const wonPrize = selectedSegment.type === 'prize' ? prizes.find(p => p.id === selectedSegment.id) : undefined;
        setResult({
          type: selectedSegment.type,
          prize: wonPrize,
        });
        setShowResult(true);

        // Save spin result
        saveSpin(selectedSegment.type, wonPrize?.id, wonPrize?.name);
      }
    };

    requestAnimationFrame(animate);
  };

  const saveSpin = async (resultType: 'prize' | 'no_prize', prizeId?: string, prizeName?: string) => {
    if (!campaign || !participantId) return;

    try {
      // Insert spin record
      await supabase.from('minigame_spins').insert({
        campaign_id: campaign.id,
        participant_id: participantId,
        prize_id: prizeId || null,
        result_type: resultType,
        prize_name: prizeName,
      });

      // Update participant total spins
      await supabase
        .from('minigame_participants')
        .update({ 
          total_spins: spinsRemaining === campaign.max_spins_per_player ? 1 : campaign.max_spins_per_player - spinsRemaining + 1,
          total_wins: resultType === 'prize' ? 1 : 0,
          last_played_at: new Date().toISOString(),
        })
        .eq('id', participantId);

      // Update campaign stats
      await supabase
        .from('minigame_campaigns')
        .update({ 
          total_spins: ((campaign as any).total_spins || 0) + 1 
        })
        .eq('id', campaign.id);

      // Note: Prize quantity tracking can be added via database trigger
    } catch (error) {
      console.error('Error saving spin:', error);
    }
  };

  const handlePasswordSubmit = () => {
    if (campaign?.password === password) {
      setShowPasswordDialog(false);
    } else {
      toast({
        title: 'Mật khẩu không đúng',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-500">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-500">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-12 text-center">
            <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Không tìm thấy chương trình</h2>
            <p className="text-muted-foreground">Chương trình không tồn tại hoặc đã kết thúc.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ 
        background: `linear-gradient(135deg, ${campaign.wheel_background_color}40, ${campaign.spin_button_color}40)` 
      }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">{campaign.name}</h1>
          {campaign.description && (
            <p className="text-muted-foreground">{campaign.description}</p>
          )}
          {campaign.sponsor_name && (
            <p className="text-sm text-muted-foreground mt-2">
              Tài trợ bởi: <strong>{campaign.sponsor_name}</strong>
            </p>
          )}
        </div>

        {/* Player Form */}
        {showForm ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-center">Nhập thông tin để tham gia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {campaign.require_name && (
                <div className="space-y-2">
                  <Label htmlFor="name">Họ tên *</Label>
                  <Input
                    id="name"
                    placeholder="Nhập họ tên của bạn"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              {campaign.require_phone && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại *</Label>
                  <Input
                    id="phone"
                    placeholder="Nhập số điện thoại"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              )}
              {campaign.require_email && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Nhập email của bạn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}
              <Button 
                className="w-full" 
                onClick={handleSubmitPlayer}
                style={{ backgroundColor: campaign.spin_button_color }}
              >
                Tham gia ngay
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Wheel */}
            <div className="relative flex justify-center mb-6">
              <div 
                className="rounded-full p-2"
                style={{ 
                  background: `linear-gradient(45deg, ${campaign.wheel_border_color}, ${campaign.wheel_background_color})`,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={300}
                  className="rounded-full"
                />
              </div>
            </div>

            {/* Spin Button */}
            <div className="text-center space-y-4">
              <Button
                size="lg"
                className="text-lg px-8 py-6"
                onClick={handleSpin}
                disabled={isSpinning || spinsRemaining <= 0}
                style={{ backgroundColor: campaign.spin_button_color }}
              >
                {isSpinning ? (
                  <>
                    <RotateCw className="h-5 w-5 mr-2 animate-spin" />
                    Đang quay...
                  </>
                ) : (
                  <>
                    <Gift className="h-5 w-5 mr-2" />
                    {campaign.spin_button_text}
                  </>
                )}
              </Button>

              <p className="text-sm text-muted-foreground">
                Bạn còn <strong>{spinsRemaining}</strong> lượt quay
              </p>
            </div>
          </>
        )}
      </div>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Nhập mật khẩu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Mật khẩu chương trình"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button className="w-full" onClick={handlePasswordSubmit}>
              Xác nhận
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-md text-center">
          {result?.type === 'prize' ? (
            <>
              <div className="flex justify-center mb-4">
                <PartyPopper className="h-16 w-16 text-yellow-500" />
              </div>
              <DialogTitle className="text-2xl mb-2">🎉 Chúc mừng!</DialogTitle>
              <p className="text-lg">
                Bạn đã trúng: <strong className="text-primary">{result.prize?.name}</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Vui lòng liên hệ cửa hàng để nhận thưởng
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <Frown className="h-16 w-16 text-muted-foreground" />
              </div>
              <DialogTitle className="text-xl mb-2">{campaign.no_prize_message}</DialogTitle>
              {spinsRemaining > 0 && (
                <p className="text-sm text-muted-foreground">
                  Bạn còn {spinsRemaining} lượt quay
                </p>
              )}
            </>
          )}
          <Button className="mt-4" onClick={() => setShowResult(false)}>
            {spinsRemaining > 0 ? 'Quay tiếp' : 'Đóng'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
