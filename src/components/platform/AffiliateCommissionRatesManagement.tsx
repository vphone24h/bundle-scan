import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Percent, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useAffiliateCommissionRates,
  useUpsertCommissionRate,
  useDeleteCommissionRate,
} from '@/hooks/useAffiliate';

export function AffiliateCommissionRatesManagement() {
  const { data: rates, isLoading } = useAffiliateCommissionRates();
  const upsertRate = useUpsertCommissionRate();
  const deleteRate = useDeleteCommissionRate();

  const { data: plans } = useQuery({
    queryKey: ['subscription-plans-for-affiliate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<any>(null);
  const [form, setForm] = useState({
    plan_id: '',
    commission_type: 'percentage' as 'percentage' | 'fixed',
    commission_value: 20,
  });

  const handleOpenAdd = () => {
    setEditingRate(null);
    setForm({ plan_id: '', commission_type: 'percentage', commission_value: 20 });
    setDialogOpen(true);
  };

  const handleOpenEdit = (rate: any) => {
    setEditingRate(rate);
    setForm({
      plan_id: rate.plan_id,
      commission_type: rate.commission_type,
      commission_value: rate.commission_value,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    await upsertRate.mutateAsync(form);
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa mức hoa hồng này?')) {
      await deleteRate.mutateAsync(id);
    }
  };

  const usedPlanIds = rates?.map(r => r.plan_id) || [];
  const availablePlans = editingRate
    ? plans
    : plans?.filter(p => !usedPlanIds.includes(p.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Mức hoa hồng theo gói</CardTitle>
            <CardDescription>
              Cấu hình tỷ lệ hoặc số tiền hoa hồng cho từng gói subscription
            </CardDescription>
          </div>
          <Button onClick={handleOpenAdd} disabled={!availablePlans?.length}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm mức hoa hồng
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gói</TableHead>
              <TableHead>Giá gói</TableHead>
              <TableHead>Kiểu tính</TableHead>
              <TableHead>Giá trị</TableHead>
              <TableHead>Hoa hồng ước tính</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Chưa có mức hoa hồng nào. Thêm mức hoa hồng cho từng gói subscription.
                </TableCell>
              </TableRow>
            ) : (
              rates?.map((rate) => {
                const planPrice = rate.subscription_plans?.price || 0;
                const estimatedCommission = rate.commission_type === 'percentage'
                  ? (planPrice * rate.commission_value / 100)
                  : rate.commission_value;

                return (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">
                      {rate.subscription_plans?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {planPrice.toLocaleString('vi-VN')} VND
                    </TableCell>
                    <TableCell>
                      {rate.commission_type === 'percentage' ? (
                        <span className="flex items-center gap-1">
                          <Percent className="h-4 w-4" />
                          Phần trăm
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          Cố định
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rate.commission_type === 'percentage'
                        ? `${rate.commission_value}%`
                        : `${rate.commission_value.toLocaleString('vi-VN')} VND`}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {estimatedCommission.toLocaleString('vi-VN')} VND
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(rate)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rate.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRate ? 'Sửa mức hoa hồng' : 'Thêm mức hoa hồng'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Gói subscription</Label>
              <Select
                value={form.plan_id}
                onValueChange={(v) => setForm({ ...form, plan_id: v })}
                disabled={!!editingRate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn gói" />
                </SelectTrigger>
                <SelectContent>
                  {(editingRate ? plans : availablePlans)?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {plan.price.toLocaleString('vi-VN')} VND
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kiểu tính hoa hồng</Label>
              <Select
                value={form.commission_type}
                onValueChange={(v: 'percentage' | 'fixed') => setForm({ ...form, commission_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                  <SelectItem value="fixed">Số tiền cố định (VND)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {form.commission_type === 'percentage' ? 'Phần trăm (%)' : 'Số tiền (VND)'}
              </Label>
              <Input
                type="number"
                min="0"
                step={form.commission_type === 'percentage' ? '1' : '10000'}
                value={form.commission_value}
                onChange={(e) => setForm({ ...form, commission_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.plan_id || upsertRate.isPending}
            >
              {upsertRate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
