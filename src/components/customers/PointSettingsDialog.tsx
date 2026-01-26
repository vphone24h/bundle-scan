import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  usePointSettings,
  useUpdatePointSettings,
  useMembershipTiers,
  useUpdateMembershipTier,
  MEMBERSHIP_TIER_NAMES,
} from '@/hooks/useCustomerPoints';
import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
import { toast } from 'sonner';
import { useState } from 'react';

const settingsSchema = z.object({
  is_enabled: z.boolean(),
  spend_amount: z.string().min(1),
  earn_points: z.string().min(1),
  redeem_points: z.string().min(1),
  redeem_value: z.string().min(1),
  max_redeem_percentage: z.string().min(1),
  points_expire: z.boolean(),
  points_expire_days: z.string().optional(),
  require_full_payment: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface PointSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PointSettingsDialog({ open, onOpenChange }: PointSettingsDialogProps) {
  const { data: settings, isLoading } = usePointSettings();
  const { data: tiers } = useMembershipTiers();
  const updateSettings = useUpdatePointSettings();
  const updateTier = useUpdateMembershipTier();

  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [tierValues, setTierValues] = useState<Record<string, { min_spent: string; points_multiplier: string }>>({});

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      is_enabled: true,
      spend_amount: '10000',
      earn_points: '1',
      redeem_points: '1',
      redeem_value: '1000',
      max_redeem_percentage: '30',
      points_expire: false,
      points_expire_days: '365',
      require_full_payment: true,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        is_enabled: settings.is_enabled,
        spend_amount: formatNumber(settings.spend_amount),
        earn_points: String(settings.earn_points),
        redeem_points: String(settings.redeem_points),
        redeem_value: formatNumber(settings.redeem_value),
        max_redeem_percentage: String(settings.max_redeem_percentage),
        points_expire: settings.points_expire,
        points_expire_days: String(settings.points_expire_days || 365),
        require_full_payment: settings.require_full_payment,
      });
    }
  }, [settings, form]);

  useEffect(() => {
    if (tiers) {
      const values: Record<string, { min_spent: string; points_multiplier: string }> = {};
      tiers.forEach(tier => {
        values[tier.id] = {
          min_spent: formatNumber(tier.min_spent),
          points_multiplier: String(tier.points_multiplier),
        };
      });
      setTierValues(values);
    }
  }, [tiers]);

  const onSubmit = async (data: SettingsFormData) => {
    try {
      await updateSettings.mutateAsync({
        is_enabled: data.is_enabled,
        spend_amount: parseFormattedNumber(data.spend_amount),
        earn_points: parseInt(data.earn_points),
        redeem_points: parseInt(data.redeem_points),
        redeem_value: parseFormattedNumber(data.redeem_value),
        max_redeem_percentage: parseFloat(data.max_redeem_percentage),
        points_expire: data.points_expire,
        points_expire_days: data.points_expire ? parseInt(data.points_expire_days || '365') : null,
        require_full_payment: data.require_full_payment,
      });
      toast.success('Cập nhật cài đặt thành công');
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra');
    }
  };

  const handleSaveTier = async (tierId: string) => {
    const tier = tiers?.find(t => t.id === tierId);
    const values = tierValues[tierId];
    if (!tier || !values) return;

    try {
      await updateTier.mutateAsync({
        ...tier,
        min_spent: parseFormattedNumber(values.min_spent),
        points_multiplier: parseFloat(values.points_multiplier),
      });
      toast.success('Cập nhật hạng thành viên thành công');
      setEditingTier(null);
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra');
    }
  };

  const watchPointsExpire = form.watch('points_expire');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cài đặt tích điểm</DialogTitle>
          <DialogDescription>Cấu hình quy tắc tích điểm và hạng thành viên</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">Cài đặt chung</TabsTrigger>
            <TabsTrigger value="tiers">Hạng thành viên</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            {isLoading ? (
              <div className="py-8 text-center">Đang tải...</div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Enable/Disable */}
                  <Card>
                    <CardContent className="pt-6">
                      <FormField
                        control={form.control}
                        name="is_enabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <div>
                              <FormLabel>Bật tích điểm</FormLabel>
                              <FormDescription>Cho phép khách hàng tích điểm khi mua hàng</FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Earn Points */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tỷ lệ tích điểm</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="spend_amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Chi tiêu (VNĐ)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  onChange={(e) => field.onChange(formatInputNumber(e.target.value))}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="earn_points"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Điểm nhận được</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Mua {form.watch('spend_amount')} VNĐ = {form.watch('earn_points')} điểm
                      </p>
                    </CardContent>
                  </Card>

                  {/* Redeem Points */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Quy đổi điểm</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="redeem_points"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Số điểm</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="redeem_value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Giá trị (VNĐ)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  onChange={(e) => field.onChange(formatInputNumber(e.target.value))}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {form.watch('redeem_points')} điểm = {form.watch('redeem_value')} VNĐ
                      </p>

                      <FormField
                        control={form.control}
                        name="max_redeem_percentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Giới hạn dùng điểm (% đơn hàng)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              Tối đa {field.value}% giá trị đơn hàng được thanh toán bằng điểm
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Other Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Cài đặt khác</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="require_full_payment"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <div>
                              <FormLabel>Yêu cầu thanh toán đủ</FormLabel>
                              <FormDescription>
                                Điểm chỉ được kích hoạt khi đơn hàng được thanh toán đầy đủ
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="points_expire"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <div>
                              <FormLabel>Điểm có hết hạn</FormLabel>
                              <FormDescription>Điểm sẽ hết hạn sau một khoảng thời gian</FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {watchPointsExpire && (
                        <FormField
                          control={form.control}
                          name="points_expire_days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Số ngày hết hạn</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={updateSettings.isPending}>
                      Lưu cài đặt
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </TabsContent>

          <TabsContent value="tiers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cấu hình hạng thành viên</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hạng</TableHead>
                      <TableHead className="text-right">Chi tiêu tối thiểu</TableHead>
                      <TableHead className="text-right">Nhân điểm</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiers?.map((tier) => (
                      <TableRow key={tier.id}>
                        <TableCell className="font-medium">
                          {MEMBERSHIP_TIER_NAMES[tier.tier]}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingTier === tier.id ? (
                            <Input
                              value={tierValues[tier.id]?.min_spent || ''}
                              onChange={(e) =>
                                setTierValues({
                                  ...tierValues,
                                  [tier.id]: {
                                    ...tierValues[tier.id],
                                    min_spent: formatInputNumber(e.target.value),
                                  },
                                })
                              }
                              className="w-32 text-right"
                            />
                          ) : (
                            formatNumber(tier.min_spent)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingTier === tier.id ? (
                            <Input
                              type="number"
                              step="0.1"
                              value={tierValues[tier.id]?.points_multiplier || ''}
                              onChange={(e) =>
                                setTierValues({
                                  ...tierValues,
                                  [tier.id]: {
                                    ...tierValues[tier.id],
                                    points_multiplier: e.target.value,
                                  },
                                })
                              }
                              className="w-20 text-right"
                            />
                          ) : (
                            `x${tier.points_multiplier}`
                          )}
                        </TableCell>
                        <TableCell>
                          {editingTier === tier.id ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveTier(tier.id)}>
                                Lưu
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingTier(null)}>
                                Hủy
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setEditingTier(tier.id)}>
                              Sửa
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
