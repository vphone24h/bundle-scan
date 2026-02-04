import { useState } from 'react';
import { Plus, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomerSources, useCreateCustomerSource } from '@/hooks/useCustomerSources';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CustomerSourceSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  showLabel?: boolean;
}

export function CustomerSourceSelect({ 
  value, 
  onChange, 
  className,
  showLabel = true 
}: CustomerSourceSelectProps) {
  const { data: sources, isLoading } = useCustomerSources();
  const createSource = useCreateCustomerSource();
  const [isAdding, setIsAdding] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');

  const handleAddSource = async () => {
    if (!newSourceName.trim()) {
      toast.error('Vui lòng nhập tên nguồn khách hàng');
      return;
    }

    try {
      const newSource = await createSource.mutateAsync(newSourceName.trim());
      onChange(newSource.name);
      setNewSourceName('');
      setIsAdding(false);
      toast.success('Đã thêm nguồn khách hàng mới');
    } catch (error: any) {
      toast.error(error.message || 'Không thể thêm nguồn khách hàng');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSource();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewSourceName('');
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && (
        <Label className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Nguồn khách hàng
        </Label>
      )}
      
      {isAdding ? (
        <div className="flex gap-2">
          <Input
            placeholder="Nhập tên nguồn mới..."
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex-1"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleAddSource}
            disabled={createSource.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              setIsAdding(false);
              setNewSourceName('');
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Select value={value || '_none_'} onValueChange={(v) => onChange(v === '_none_' ? '' : v)}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Chọn nguồn khách hàng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none_">Không chọn</SelectItem>
              {sources?.map((source) => (
                <SelectItem key={source.id} value={source.name}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setIsAdding(true)}
            title="Thêm nguồn mới"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
