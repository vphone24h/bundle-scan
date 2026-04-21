import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Plus, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AddressEditorProps {
  mainAddress: string;
  additionalAddresses: string[];
  onSave: (mainAddress: string, additionalAddresses: string[]) => void;
  compact?: boolean;
  isSaving?: boolean;
}

export function AddressEditor({ mainAddress, additionalAddresses, onSave, compact, isSaving }: AddressEditorProps) {
  const [localMain, setLocalMain] = useState(mainAddress || '');
  const [localAdditional, setLocalAdditional] = useState<string[]>(additionalAddresses || []);

  useEffect(() => {
    setLocalMain(mainAddress || '');
    setLocalAdditional(additionalAddresses || []);
  }, [mainAddress, additionalAddresses]);

  const hasChanges =
    localMain !== (mainAddress || '') ||
    JSON.stringify(localAdditional) !== JSON.stringify(additionalAddresses || []);

  const handleSave = () => {
    // Filter out empty additional addresses
    const cleaned = localAdditional.filter(a => a.trim());
    onSave(localMain, cleaned);
    toast({ title: '✓ Đã lưu địa chỉ' });
  };

  const labelClass = compact ? 'text-xs' : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className={labelClass}>Địa chỉ</Label>
        <button
          type="button"
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
          onClick={() => setLocalAdditional(prev => [...prev, ''])}
        >
          <Plus className="h-3 w-3" />
          Thêm địa chỉ
        </button>
      </div>
      <Input
        value={localMain}
        onChange={e => setLocalMain(e.target.value)}
        placeholder="Địa chỉ chính"
      />
      {localAdditional.map((addr, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={addr}
            onChange={e => {
              const updated = [...localAdditional];
              updated[index] = e.target.value;
              setLocalAdditional(updated);
            }}
            placeholder={`Địa chỉ ${index + 2}`}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive hover:text-destructive shrink-0"
            onClick={() => setLocalAdditional(prev => prev.filter((_, i) => i !== index))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {localAdditional.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          Nếu có nhiều chi nhánh, nhấn "Thêm địa chỉ"
        </p>
      )}
      <Button
        type="button"
        size="sm"
        className="w-full gap-1.5"
        onClick={handleSave}
        disabled={!hasChanges || isSaving}
      >
        <Save className="h-3.5 w-3.5" />
        Lưu địa chỉ
      </Button>
    </div>
  );
}