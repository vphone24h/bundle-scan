import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const COMMON_TYPES = [
  'Điện thoại / Điện tử',
  'Phụ kiện điện thoại',
  'Máy tính / Laptop',
  'Đồng hồ / Trang sức',
  'Thời trang',
  'Mỹ phẩm',
  'Thực phẩm',
  'Vật liệu xây dựng',
  'Nông sản',
  'Khác',
];

interface BusinessTypeDialogProps {
  open: boolean;
  tenantId: string;
}

export function BusinessTypeDialog({ open, tenantId }: BusinessTypeDialogProps) {
  const [selected, setSelected] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    const value = selected === 'Khác' ? customValue.trim() : selected;
    if (!value) {
      toast({ title: 'Vui lòng chọn ngành nghề', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('tenants')
      .update({ business_type: value })
      .eq('id', tenantId);

    if (error) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Đã cập nhật ngành nghề!' });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-combined'] });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Chọn ngành nghề kinh doanh</DialogTitle>
          <DialogDescription>
            Vui lòng cho chúng tôi biết ngành nghề của bạn để phục vụ tốt hơn.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {COMMON_TYPES.map((t) => (
            <Button
              key={t}
              type="button"
              variant={selected === t ? 'default' : 'outline'}
              size="sm"
              className="justify-start text-xs h-9"
              onClick={() => setSelected(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        {selected === 'Khác' && (
          <div className="space-y-1.5 mt-2">
            <Label htmlFor="custom-type">Nhập ngành nghề</Label>
            <Input
              id="custom-type"
              placeholder="VD: Nội thất, Xe máy..."
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <Button
          className="w-full mt-3"
          onClick={handleSave}
          disabled={saving || !selected || (selected === 'Khác' && !customValue.trim())}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Xác nhận
        </Button>
      </DialogContent>
    </Dialog>
  );
}
