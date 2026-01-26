import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  Save, 
  Phone, 
  Building2, 
  Plus, 
  Trash2,
  GripVertical,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PaymentConfig {
  id: string;
  config_key: string;
  config_value: string | null;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_active: boolean;
  display_order: number;
}

export function PaymentConfigManagement() {
  const queryClient = useQueryClient();
  const [hotline, setHotline] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Bank account dialog
  const [bankDialog, setBankDialog] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_number: '',
    account_holder: '',
    is_active: true,
  });

  // Fetch payment config
  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_config')
        .select('*');
      if (error) throw error;
      return data as PaymentConfig[];
    },
  });

  // Fetch bank accounts
  const { data: bankAccounts, isLoading: loadingBanks } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  // Update configs when loaded
  useEffect(() => {
    if (configs) {
      const hotlineConfig = configs.find(c => c.config_key === 'hotline');
      const emailConfig = configs.find(c => c.config_key === 'support_email');
      const companyConfig = configs.find(c => c.config_key === 'company_name');
      
      if (hotlineConfig?.config_value) setHotline(hotlineConfig.config_value);
      if (emailConfig?.config_value) setSupportEmail(emailConfig.config_value);
      if (companyConfig?.config_value) setCompanyName(companyConfig.config_value);
    }
  }, [configs]);

  // Save config mutation
  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const updates = [
        { config_key: 'hotline', config_value: hotline },
        { config_key: 'support_email', config_value: supportEmail },
        { config_key: 'company_name', config_value: companyName },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('payment_config')
          .upsert(update, { onConflict: 'config_key' });
        if (error) throw error;
      }

      toast({
        title: 'Thành công',
        description: 'Đã lưu cấu hình thanh toán',
      });

      queryClient.invalidateQueries({ queryKey: ['payment-config'] });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
    setSavingConfig(false);
  };

  // Bank account mutations
  const saveBankMutation = useMutation({
    mutationFn: async (data: typeof bankForm & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('bank_accounts')
          .update(data)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bank_accounts')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Thành công',
        description: 'Đã lưu tài khoản ngân hàng',
      });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      setBankDialog(false);
      setEditingBank(null);
      setBankForm({
        bank_name: '',
        account_number: '',
        account_holder: '',
        is_active: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleBankStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });

  const deleteBankMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Thành công',
        description: 'Đã xóa tài khoản ngân hàng',
      });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });

  const handleEditBank = (bank: BankAccount) => {
    setEditingBank(bank);
    setBankForm({
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      account_holder: bank.account_holder,
      is_active: bank.is_active,
    });
    setBankDialog(true);
  };

  const handleSaveBank = () => {
    saveBankMutation.mutate({
      ...bankForm,
      id: editingBank?.id,
    });
  };

  if (loadingConfigs || loadingBanks) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* General Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Thông tin hỗ trợ
          </CardTitle>
          <CardDescription>
            Cấu hình thông tin liên hệ hiển thị trên trang thanh toán
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tên công ty</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Kho Hàng Pro"
              />
            </div>
            <div className="space-y-2">
              <Label>Hotline hỗ trợ</Label>
              <Input
                value={hotline}
                onChange={(e) => setHotline(e.target.value)}
                placeholder="0123456789"
              />
            </div>
            <div className="space-y-2">
              <Label>Email hỗ trợ</Label>
              <Input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@example.com"
              />
            </div>
          </div>
          <Button onClick={saveConfig} disabled={savingConfig}>
            {savingConfig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Lưu cấu hình
          </Button>
        </CardContent>
      </Card>

      {/* Bank Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Tài khoản ngân hàng
              </CardTitle>
              <CardDescription>
                Danh sách tài khoản nhận thanh toán
              </CardDescription>
            </div>
            <Button onClick={() => {
              setEditingBank(null);
              setBankForm({
                bank_name: '',
                account_number: '',
                account_holder: '',
                is_active: true,
              });
              setBankDialog(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm tài khoản
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bankAccounts?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Chưa có tài khoản ngân hàng nào
            </p>
          ) : (
            <div className="space-y-3">
              {bankAccounts?.map((bank) => (
                <div
                  key={bank.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    !bank.is_active ? 'opacity-50 bg-muted' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{bank.bank_name}</p>
                        {bank.is_active ? (
                          <Badge variant="default">Đang dùng</Badge>
                        ) : (
                          <Badge variant="secondary">Đã ẩn</Badge>
                        )}
                      </div>
                      <p className="text-sm font-mono">{bank.account_number}</p>
                      <p className="text-sm text-muted-foreground">{bank.account_holder}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleBankStatus.mutate({ 
                        id: bank.id, 
                        is_active: !bank.is_active 
                      })}
                    >
                      {bank.is_active ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditBank(bank)}
                    >
                      Sửa
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm('Bạn có chắc muốn xóa tài khoản này?')) {
                          deleteBankMutation.mutate(bank.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bank Account Dialog */}
      <Dialog open={bankDialog} onOpenChange={setBankDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBank ? 'Sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'}
            </DialogTitle>
            <DialogDescription>
              Thông tin tài khoản sẽ hiển thị trong mã QR thanh toán
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tên ngân hàng</Label>
              <Input
                value={bankForm.bank_name}
                onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                placeholder="VD: Vietcombank, MB Bank, ..."
              />
            </div>
            <div className="space-y-2">
              <Label>Số tài khoản</Label>
              <Input
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Tên chủ tài khoản</Label>
              <Input
                value={bankForm.account_holder}
                onChange={(e) => setBankForm({ ...bankForm, account_holder: e.target.value })}
                placeholder="NGUYEN VAN A"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={bankForm.is_active}
                onCheckedChange={(checked) => setBankForm({ ...bankForm, is_active: checked })}
              />
              <Label>Đang sử dụng</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialog(false)}>
              Hủy
            </Button>
            <Button 
              onClick={handleSaveBank}
              disabled={saveBankMutation.isPending || !bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder}
            >
              {saveBankMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
