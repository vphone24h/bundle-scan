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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAdjustPoints } from '@/hooks/useCustomerPoints';
import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
import { toast } from 'sonner';
import { useState } from 'react';

const formSchema = z.object({
  type: z.enum(['add', 'subtract']),
  points: z.string().min(1, 'Số điểm là bắt buộc'),
  description: z.string().min(1, 'Lý do là bắt buộc').max(500),
  note: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PointAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  currentPoints: number;
}

export function PointAdjustDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  currentPoints,
}: PointAdjustDialogProps) {
  const [pointsInput, setPointsInput] = useState('');
  const adjustPoints = useAdjustPoints();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'add',
      points: '',
      description: '',
      note: '',
    },
  });

  const watchType = form.watch('type');
  const pointsValue = parseFormattedNumber(pointsInput);

  const newBalance = watchType === 'add' 
    ? currentPoints + pointsValue 
    : currentPoints - pointsValue;

  const onSubmit = async (data: FormData) => {
    try {
      const points = parseFormattedNumber(data.points);
      if (points <= 0) {
        toast.error('Số điểm phải lớn hơn 0');
        return;
      }

      const adjustedPoints = data.type === 'add' ? points : -points;

      if (currentPoints + adjustedPoints < 0) {
        toast.error('Số điểm sau điều chỉnh không thể âm');
        return;
      }

      await adjustPoints.mutateAsync({
        customerId,
        points: adjustedPoints,
        description: data.description,
        note: data.note,
      });

      toast.success('Điều chỉnh điểm thành công');
      form.reset();
      setPointsInput('');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra');
    }
  };

  const handlePointsChange = (value: string) => {
    const formatted = formatInputNumber(value);
    setPointsInput(formatted);
    form.setValue('points', formatted);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Điều chỉnh điểm</DialogTitle>
          <DialogDescription>
            Khách hàng: <strong>{customerName}</strong><br />
            Điểm hiện tại: <strong className="text-primary">{formatNumber(currentPoints)}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại điều chỉnh</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="add" id="add" />
                        <label htmlFor="add" className="text-sm font-medium text-green-600">
                          + Cộng điểm
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="subtract" id="subtract" />
                        <label htmlFor="subtract" className="text-sm font-medium text-red-600">
                          − Trừ điểm
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="points"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số điểm</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nhập số điểm"
                      value={pointsInput}
                      onChange={(e) => handlePointsChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {pointsValue > 0 && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p>
                  Số dư sau điều chỉnh:{' '}
                  <strong className={newBalance >= 0 ? 'text-primary' : 'text-red-600'}>
                    {formatNumber(Math.max(0, newBalance))} điểm
                  </strong>
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lý do điều chỉnh *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhập lý do điều chỉnh" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ghi chú thêm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button 
                type="submit" 
                disabled={adjustPoints.isPending || newBalance < 0}
              >
                Xác nhận
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
