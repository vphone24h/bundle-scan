import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  useCreateMinigamePrize,
  useUpdateMinigamePrize,
  useDeleteMinigamePrize,
  MinigameCampaign,
  MinigamePrize
} from '@/hooks/useMinigame';
import { ChevronUp, ChevronDown, Edit, Trash2, Loader2, Plus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface MinigamePrizesTabProps {
  campaign: MinigameCampaign;
  prizes: MinigamePrize[];
}

const PRIZE_TYPES = [
  { value: 'gift', label: 'Phần quà' },
  { value: 'voucher', label: 'Voucher giảm giá' },
  { value: 'product', label: 'Sản phẩm' },
  { value: 'points', label: 'Điểm thưởng' },
  { value: 'other', label: 'Khác' },
];

const SEGMENT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

export function MinigamePrizesTab({ campaign, prizes }: MinigamePrizesTabProps) {
  const createPrize = useCreateMinigamePrize();
  const updatePrize = useUpdateMinigamePrize();
  const deletePrize = useDeleteMinigamePrize();

  const [prizeType, setPrizeType] = useState('gift');
  const [prizeName, setPrizeName] = useState('');
  const [prizeQuantity, setPrizeQuantity] = useState<number>(1);
  const [prizeProbability, setPrizeProbability] = useState<number>(10);
  const [prizeClaimLink, setPrizeClaimLink] = useState('');
  const [prizeDescription, setPrizeDescription] = useState('');
  const [editingPrize, setEditingPrize] = useState<MinigamePrize | null>(null);

  const totalProbability = prizes.reduce((sum, p) => sum + p.probability, 0) + campaign.no_prize_probability;

  const handleAddPrize = async () => {
    if (!prizeName.trim()) return;

    await createPrize.mutateAsync({
      campaign_id: campaign.id,
      name: prizeName,
      prize_type: prizeType,
      probability: prizeProbability,
      total_quantity: prizeQuantity,
      remaining_quantity: prizeQuantity,
      color: SEGMENT_COLORS[prizes.length % SEGMENT_COLORS.length],
      display_order: prizes.length,
      is_active: true,
    });

    // Reset form
    setPrizeName('');
    setPrizeQuantity(1);
    setPrizeProbability(10);
    setPrizeClaimLink('');
    setPrizeDescription('');
  };

  const handleMovePrize = async (prize: MinigamePrize, direction: 'up' | 'down') => {
    const currentIndex = prizes.findIndex(p => p.id === prize.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= prizes.length) return;

    const otherPrize = prizes[newIndex];

    await Promise.all([
      updatePrize.mutateAsync({ id: prize.id, display_order: newIndex }),
      updatePrize.mutateAsync({ id: otherPrize.id, display_order: currentIndex }),
    ]);
  };

  const handleDeletePrize = async (prize: MinigamePrize) => {
    await deletePrize.mutateAsync({ id: prize.id, campaignId: campaign.id });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form thêm giải thưởng */}
      <Card>
        <CardHeader className="bg-primary text-primary-foreground py-3 px-4 rounded-t-lg">
          <span className="font-medium">Thêm giải thưởng</span>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-3 rounded-lg text-sm">
            Tổng tỷ lệ trúng của các giải thưởng phải {'<='} 100%
          </div>

          <div className="space-y-2">
            <Label>Loại giải thưởng</Label>
            <Select value={prizeType} onValueChange={setPrizeType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIZE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tên giải thưởng</Label>
            <Input
              placeholder="VD: Voucher 500k"
              value={prizeName}
              onChange={(e) => setPrizeName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Hình ảnh</Label>
            <Button variant="outline" size="sm">Chọn ảnh</Button>
            <p className="text-xs text-muted-foreground">Vui lòng điền vào trường này.</p>
          </div>

          <div className="space-y-2">
            <Label>Số lượng</Label>
            <Input
              type="number"
              min={0}
              value={prizeQuantity}
              onChange={(e) => setPrizeQuantity(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Tỷ lệ trúng (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={prizeProbability}
              onChange={(e) => setPrizeProbability(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Liên kết nhận quà</Label>
            <Input
              placeholder="https://..."
              value={prizeClaimLink}
              onChange={(e) => setPrizeClaimLink(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Giới thiệu giải thưởng</Label>
            <Textarea
              placeholder="Mô tả chi tiết về giải thưởng..."
              value={prizeDescription}
              onChange={(e) => setPrizeDescription(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            onClick={handleAddPrize}
            disabled={createPrize.isPending || !prizeName.trim()}
            className="w-full"
          >
            {createPrize.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Lưu giải thưởng
          </Button>
        </CardContent>
      </Card>

      {/* Danh sách giải thưởng */}
      <Card>
        <CardHeader className="bg-primary text-primary-foreground py-3 px-4 rounded-t-lg">
          <span className="font-medium">Danh sách giải thưởng</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Tên</TableHead>
                <TableHead className="text-center">Hình ảnh</TableHead>
                <TableHead className="text-center">Số lượng</TableHead>
                <TableHead className="text-center">Tỷ lệ trúng</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prizes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Chưa có giải thưởng nào
                  </TableCell>
                </TableRow>
              ) : (
                prizes.map((prize, index) => (
                  <TableRow key={prize.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => handleMovePrize(prize, 'up')}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === prizes.length - 1}
                          onClick={() => handleMovePrize(prize, 'down')}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: prize.color }}
                        />
                        <span className="font-medium">{prize.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center mx-auto">
                        {prize.image ? (
                          <img src={prize.image} alt={prize.name} className="w-full h-full object-cover rounded" />
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        Còn {prize.remaining_quantity || 0} / {prize.total_quantity || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{prize.probability}%</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4 text-primary" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa giải thưởng?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc muốn xóa giải thưởng "{prize.name}"? Hành động này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeletePrize(prize)}>
                                Xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Summary */}
          <div className="p-4 border-t">
            <div className={`text-sm font-medium ${totalProbability <= 100 ? 'text-green-600' : 'text-red-600'}`}>
              Tổng tỷ lệ: {totalProbability}%
              {totalProbability > 100 && ' (Vượt quá 100%!)'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
