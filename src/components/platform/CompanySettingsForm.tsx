import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useCompanySettings, useUpsertCompanySettings, BankAccount } from '@/hooks/useCompanySettings';
import { usePlatformUser } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Plus, Trash2, Building2, Phone, Mail, Globe, CreditCard, Image, Upload } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function CompanySettingsForm() {
  const { data: platformUser } = usePlatformUser();
  const companyId = platformUser?.company_id;
  const { data: settings, isLoading } = useCompanySettings(companyId);
  const upsert = useUpsertCompanySettings();

  const [displayName, setDisplayName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setDisplayName(settings.display_name || '');
      setSlogan(settings.slogan || '');
      setLogoUrl(settings.logo_url || '');
      setPhone(settings.phone || '');
      setEmail(settings.email || '');
      setWebsite(settings.website || '');
      setAddress(settings.address || '');
      setDescription(settings.description || '');
      setBankAccounts(settings.bank_accounts || []);
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Lỗi', description: 'Chỉ hỗ trợ PNG, JPG, WebP, SVG', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Lỗi', description: 'File tối đa 2MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `logos/${companyId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(path);

      setLogoUrl(urlData.publicUrl + '?t=' + Date.now());
      toast({ title: 'Đã tải logo lên thành công' });
    } catch (err: any) {
      toast({ title: 'Lỗi tải ảnh', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!companyId) return;
    try {
      await upsert.mutateAsync({
        company_id: companyId,
        display_name: displayName || null,
        slogan: slogan || null,
        logo_url: logoUrl || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        address: address || null,
        description: description || null,
        bank_accounts: bankAccounts,
      });
      toast({ title: 'Đã lưu cài đặt công ty' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const addBank = () => {
    setBankAccounts([...bankAccounts, { bank_name: '', account_number: '', account_holder: '' }]);
  };

  const removeBank = (idx: number) => {
    setBankAccounts(bankAccounts.filter((_, i) => i !== idx));
  };

  const updateBank = (idx: number, field: keyof BankAccount, value: string) => {
    const updated = [...bankAccounts];
    updated[idx] = { ...updated[idx], [field]: value };
    setBankAccounts(updated);
  };

  if (!companyId) {
    return <p className="text-muted-foreground text-sm">Không xác định được công ty.</p>;
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Branding */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Thông tin hiển thị
          </CardTitle>
          <CardDescription className="text-xs">
            Tên, logo, slogan hiển thị trên trang landing và header cho domain của bạn
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Tên hiển thị</Label>
              <Input placeholder="Tên công ty" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Slogan</Label>
              <Input placeholder="VD: Quản lý thông minh" value={slogan} onChange={e => setSlogan(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Image className="h-3.5 w-3.5" />
              Logo công ty
            </Label>
            <div className="flex items-center gap-3">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-14 w-14 object-contain rounded-lg border" />
              )}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? 'Đang tải...' : 'Chọn ảnh logo'}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, SVG • Tối đa 2MB</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Mô tả ngắn</Label>
            <Textarea placeholder="Mô tả về công ty..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Thông tin liên hệ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Số điện thoại</Label>
              <Input placeholder="0xxx.xxx.xxx" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</Label>
              <Input placeholder="email@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Website</Label>
              <Input placeholder="company.vn" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Địa chỉ</Label>
              <Input placeholder="Địa chỉ..." value={address} onChange={e => setAddress(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Accounts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Tài khoản ngân hàng
          </CardTitle>
          <CardDescription className="text-xs">
            Hiển thị cho người dùng khi thanh toán gói dịch vụ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bankAccounts.map((bank, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-3 relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 text-destructive"
                onClick={() => removeBank(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <div className="grid gap-3 sm:grid-cols-3 pr-8">
                <div className="space-y-1">
                  <Label className="text-xs">Ngân hàng</Label>
                  <Input placeholder="Tên NH" value={bank.bank_name} onChange={e => updateBank(idx, 'bank_name', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Số tài khoản</Label>
                  <Input placeholder="STK" value={bank.account_number} onChange={e => updateBank(idx, 'account_number', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Chủ tài khoản</Label>
                  <Input placeholder="Tên chủ TK" value={bank.account_holder} onChange={e => updateBank(idx, 'account_holder', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addBank} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Thêm tài khoản
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Feature toggles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Tính lãi công nợ
          </CardTitle>
          <CardDescription className="text-xs">
            Cho phép các shop trong công ty tính lãi suất trên công nợ khách/NCC. Mặc định tắt.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Cho phép tính lãi trên công nợ</p>
            <p className="text-xs text-muted-foreground">
              Khi tắt, shop vẫn thấy tab "Tính lãi" nhưng sẽ hiển thị SĐT công ty để liên hệ bật.
            </p>
          </div>
          <Switch checked={interestEnabled} onCheckedChange={handleToggleInterest} />
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsert.isPending} className="gap-2">
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Lưu cài đặt
        </Button>
      </div>
    </div>
  );
}
