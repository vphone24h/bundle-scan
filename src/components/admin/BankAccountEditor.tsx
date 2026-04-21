import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Building2 } from 'lucide-react';
import { VIETNAMESE_BANKS } from '@/lib/vietnameseBanks';
import { toast } from '@/hooks/use-toast';

interface BankAccountEditorProps {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  onSave: (bankName: string, accountNumber: string, accountHolder: string) => void;
  /** Compact mode for website editor */
  compact?: boolean;
  isSaving?: boolean;
}

export function BankAccountEditor({ bankName, accountNumber, accountHolder, onSave, compact, isSaving }: BankAccountEditorProps) {
  const [localBank, setLocalBank] = useState(bankName || '');
  const [localAccount, setLocalAccount] = useState(accountNumber || '');
  const [localHolder, setLocalHolder] = useState(accountHolder || '');

  // Sync from parent when external data changes (e.g. after save from other location)
  useEffect(() => {
    setLocalBank(bankName || '');
    setLocalAccount(accountNumber || '');
    setLocalHolder(accountHolder || '');
  }, [bankName, accountNumber, accountHolder]);

  const hasLocalChanges =
    localBank !== (bankName || '') ||
    localAccount !== (accountNumber || '') ||
    localHolder !== (accountHolder || '');

  const handleSave = () => {
    if (!localBank || !localAccount || !localHolder) {
      toast({ title: 'Vui lòng điền đầy đủ thông tin ngân hàng', variant: 'destructive' });
      return;
    }
    onSave(localBank, localAccount, localHolder);
  };

  const labelClass = compact ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <p className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>Tài khoản ngân hàng</p>
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Ngân hàng</Label>
        <Select value={localBank} onValueChange={setLocalBank}>
          <SelectTrigger className={compact ? 'h-9 text-sm' : ''}>
            <SelectValue placeholder="Chọn ngân hàng..." />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {VIETNAMESE_BANKS.map(bank => (
              <SelectItem key={bank.code} value={bank.code}>
                {bank.name} ({bank.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className={labelClass}>Số tài khoản</Label>
          <Input
            value={localAccount}
            onChange={e => setLocalAccount(e.target.value)}
            placeholder="0123456789"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass}>Chủ tài khoản</Label>
          <Input
            value={localHolder}
            onChange={e => setLocalHolder(e.target.value.toUpperCase())}
            placeholder="NGUYEN VAN A"
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="w-full gap-1.5"
        onClick={handleSave}
        disabled={!hasLocalChanges || isSaving}
      >
        <Save className="h-3.5 w-3.5" />
        Lưu tài khoản ngân hàng
      </Button>
    </div>
  );
}