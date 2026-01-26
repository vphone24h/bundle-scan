import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useBranches } from '@/hooks/useBranches';
import { useCategories } from '@/hooks/useCategories';
import { useCreateStockCount, StockCountScope } from '@/hooks/useStockCounts';

interface CreateStockCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function CreateStockCountDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateStockCountDialogProps) {
  const { data: branches } = useBranches();
  const { data: categories } = useCategories();
  const createMutation = useCreateStockCount();

  const [branchId, setBranchId] = useState<string>('');
  const [countDate, setCountDate] = useState<Date>(new Date());
  const [scope, setScope] = useState<StockCountScope>('all');
  const [scopeCategoryId, setScopeCategoryId] = useState<string>('');
  const [note, setNote] = useState('');

  const handleCreate = async () => {
    const result = await createMutation.mutateAsync({
      branchId: branchId || null,
      countDate: countDate.toISOString(),
      scope,
      scopeCategoryId: scope === 'category' ? scopeCategoryId : null,
      note,
    });

    onCreated(result.id);
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setBranchId('');
    setCountDate(new Date());
    setScope('all');
    setScopeCategoryId('');
    setNote('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Tạo phiếu kiểm kho</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Branch */}
          <div className="space-y-2">
            <Label>Chi nhánh</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Tất cả chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Tất cả chi nhánh</SelectItem>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Count Date */}
          <div className="space-y-2">
            <Label>Ngày kiểm kho</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !countDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {countDate ? format(countDate, 'dd/MM/yyyy') : 'Chọn ngày'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={countDate}
                  onSelect={(date) => date && setCountDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Scope */}
          <div className="space-y-3">
            <Label>Phạm vi kiểm kho</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as StockCountScope)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="scope-all" />
                <Label htmlFor="scope-all" className="font-normal cursor-pointer">
                  Kiểm toàn bộ kho
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="category" id="scope-category" />
                <Label htmlFor="scope-category" className="font-normal cursor-pointer">
                  Kiểm theo danh mục
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="product" id="scope-product" />
                <Label htmlFor="scope-product" className="font-normal cursor-pointer">
                  Kiểm theo sản phẩm (chọn sau)
                </Label>
              </div>
            </RadioGroup>

            {scope === 'category' && (
              <Select value={scopeCategoryId} onValueChange={setScopeCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea
              placeholder="Ghi chú cho phiếu kiểm kho..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || (scope === 'category' && !scopeCategoryId)}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
