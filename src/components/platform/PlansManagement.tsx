import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubscriptionPlans, useUpdateSubscriptionPlan, useCreateSubscriptionPlan, useDeleteSubscriptionPlan, SubscriptionPlan } from '@/hooks/useTenant';
import { Loader2, Save, Package, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/formatNumber';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type FormMode = 'idle' | 'create' | 'edit';

export function PlansManagement() {
  const { data: plans, isLoading } = useSubscriptionPlans(true);
  const updatePlan = useUpdateSubscriptionPlan();
  const createPlan = useCreateSubscriptionPlan();
  const deletePlan = useDeleteSubscriptionPlan();
  
  const [formMode, setFormMode] = useState<FormMode>('idle');
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({});

  const handleCreate = () => {
    setFormMode('create');
    setEditingPlan(null);
    setFormData({
      name: '',
      plan_type: 'monthly',
      price: 0,
      duration_days: 30,
      max_branches: 1,
      max_users: 5,
      description: '',
      is_active: true,
    });
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setFormMode('edit');
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      plan_type: plan.plan_type,
      price: plan.price,
      duration_days: plan.duration_days,
      max_branches: plan.max_branches,
      max_users: plan.max_users,
      description: plan.description,
      is_active: plan.is_active,
    });
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên gói',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (formMode === 'create') {
        await createPlan.mutateAsync({
          name: formData.name,
          plan_type: formData.plan_type as 'monthly' | 'yearly' | 'lifetime',
          price: formData.price || 0,
          duration_days: formData.duration_days || null,
          max_branches: formData.max_branches || 1,
          max_users: formData.max_users || 5,
          description: formData.description || null,
          is_active: formData.is_active ?? true,
        });

        toast({
          title: 'Thành công',
          description: 'Đã tạo gói dịch vụ mới',
        });
      } else if (formMode === 'edit' && editingPlan) {
        await updatePlan.mutateAsync({
          id: editingPlan.id,
          ...formData,
        });

        toast({
          title: 'Thành công',
          description: 'Đã cập nhật gói dịch vụ',
        });
      }

      setFormMode('idle');
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

  const handleDelete = async (planId: string) => {
    try {
      await deletePlan.mutateAsync(planId);
      toast({
        title: 'Thành công',
        description: 'Đã xóa gói dịch vụ',
      });
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
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Danh sách gói dịch vụ</h3>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Thêm gói mới
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id} className={!plan.is_active ? 'opacity-50' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {!plan.is_active && (
                    <span className="text-xs text-muted-foreground">Đã ẩn</span>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bạn có chắc chắn muốn xóa gói "{plan.name}"? Hành động này không thể hoàn tác.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(plan.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Xóa
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold text-primary">
                {formatNumber(plan.price)}đ
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loại gói:</span>
                  <span className="capitalize">{plan.plan_type === 'monthly' ? 'Tháng' : plan.plan_type === 'yearly' ? 'Năm' : 'Trọn đời'}</span>
                </div>
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
                <p className="text-sm text-muted-foreground line-clamp-3">{plan.description}</p>
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

      {/* Create/Edit Form */}
      {formMode !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>
              {formMode === 'create' ? 'Tạo gói dịch vụ mới' : `Chỉnh sửa gói: ${editingPlan?.name}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tên gói <span className="text-destructive">*</span></Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Gói Cơ bản, Gói Nâng cao..."
                />
              </div>

              <div className="space-y-2">
                <Label>Loại gói <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.plan_type || 'monthly'}
                  onValueChange={(value) => setFormData({ ...formData, plan_type: value as 'monthly' | 'yearly' | 'lifetime' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Theo tháng</SelectItem>
                    <SelectItem value="yearly">Theo năm</SelectItem>
                    <SelectItem value="lifetime">Trọn đời</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Giá (VNĐ)</Label>
                <Input
                  type="number"
                  value={formData.price || 0}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
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
                  onChange={(e) => setFormData({ ...formData, max_branches: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Số nhân viên tối đa</Label>
                <Input
                  type="number"
                  value={formData.max_users || 5}
                  onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 5 })}
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
                placeholder="Mô tả chi tiết về gói dịch vụ, các tính năng nổi bật..."
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setFormMode('idle');
                  setEditingPlan(null);
                  setFormData({});
                }}
              >
                Hủy
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={createPlan.isPending || updatePlan.isPending}
              >
                {(createPlan.isPending || updatePlan.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {formMode === 'create' ? 'Tạo gói' : 'Lưu thay đổi'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
