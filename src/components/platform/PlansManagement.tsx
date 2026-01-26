import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useSubscriptionPlans, useUpdateSubscriptionPlan, SubscriptionPlan } from '@/hooks/useTenant';
import { Loader2, Save, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/formatNumber';

export function PlansManagement() {
  const { data: plans, isLoading } = useSubscriptionPlans();
  const updatePlan = useUpdateSubscriptionPlan();
  
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({});

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price: plan.price,
      duration_days: plan.duration_days,
      max_branches: plan.max_branches,
      max_users: plan.max_users,
      description: plan.description,
      is_active: plan.is_active,
    });
  };

  const handleSave = async () => {
    if (!editingPlan) return;

    try {
      await updatePlan.mutateAsync({
        id: editingPlan.id,
        ...formData,
      });

      toast({
        title: 'Thành công',
        description: 'Đã cập nhật gói dịch vụ',
      });

      setEditingPlan(null);
      setFormData({});
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id} className={!plan.is_active ? 'opacity-50' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                {!plan.is_active && (
                  <span className="text-xs text-muted-foreground">Đã ẩn</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold text-primary">
                {formatNumber(plan.price)}đ
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Thời hạn:</span>
                  <span>{plan.duration_days ? `${plan.duration_days} ngày` : 'Vĩnh viễn'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chi nhánh:</span>
                  <span>Tối đa {plan.max_branches}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nhân viên:</span>
                  <span>Tối đa {plan.max_users}</span>
                </div>
              </div>

              {plan.description && (
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              )}

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleEdit(plan)}
              >
                Chỉnh sửa
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Form */}
      {editingPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Chỉnh sửa gói: {editingPlan.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tên gói</Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Giá (VNĐ)</Label>
                <Input
                  type="number"
                  value={formData.price || 0}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Số ngày (để trống = vĩnh viễn)</Label>
                <Input
                  type="number"
                  value={formData.duration_days || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    duration_days: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="Vĩnh viễn"
                />
              </div>

              <div className="space-y-2">
                <Label>Số chi nhánh tối đa</Label>
                <Input
                  type="number"
                  value={formData.max_branches || 1}
                  onChange={(e) => setFormData({ ...formData, max_branches: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Số nhân viên tối đa</Label>
                <Input
                  type="number"
                  value={formData.max_users || 5}
                  onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2 flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Hiển thị gói này</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả ngắn về gói dịch vụ..."
              />
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditingPlan(null);
                  setFormData({});
                }}
              >
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={updatePlan.isPending}>
                {updatePlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Lưu thay đổi
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}