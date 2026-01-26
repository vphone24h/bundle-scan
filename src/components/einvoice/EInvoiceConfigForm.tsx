import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, TestTube2, CheckCircle2, XCircle, ExternalLink, Info } from 'lucide-react';
import { useEInvoiceConfig, useSaveEInvoiceConfig, useEInvoiceAPI, EINVOICE_PROVIDERS } from '@/hooks/useEInvoice';
import { toast } from '@/hooks/use-toast';

const configSchema = z.object({
  provider: z.enum(['vnpt', 'viettel', 'fpt', 'misa', 'other']),
  provider_name: z.string().min(1, 'Tên nhà cung cấp không được để trống'),
  api_url: z.string().url('URL không hợp lệ'),
  username: z.string().optional(),
  api_key_encrypted: z.string().optional(),
  tax_code: z.string().min(10, 'Mã số thuế phải có ít nhất 10 ký tự').max(14, 'Mã số thuế tối đa 14 ký tự'),
  company_name: z.string().min(1, 'Tên công ty không được để trống'),
  company_address: z.string().optional(),
  company_phone: z.string().optional(),
  company_email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  invoice_series: z.string().optional(),
  invoice_template: z.string().optional(),
  is_active: z.boolean().default(true),
  sandbox_mode: z.boolean().default(true),
});

type ConfigFormData = z.infer<typeof configSchema>;

export function EInvoiceConfigForm() {
  const { data: existingConfig, isLoading } = useEInvoiceConfig();
  const saveConfig = useSaveEInvoiceConfig();
  const einvoiceAPI = useEInvoiceAPI();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      provider: 'vnpt',
      provider_name: 'VNPT E-Invoice',
      api_url: '',
      username: '',
      api_key_encrypted: '',
      tax_code: '',
      company_name: '',
      company_address: '',
      company_phone: '',
      company_email: '',
      invoice_series: '',
      invoice_template: '',
      is_active: true,
      sandbox_mode: true,
    },
  });

  useEffect(() => {
    if (existingConfig) {
      form.reset({
        provider: existingConfig.provider,
        provider_name: existingConfig.provider_name,
        api_url: existingConfig.api_url,
        username: existingConfig.username || '',
        api_key_encrypted: existingConfig.api_key_encrypted || '',
        tax_code: existingConfig.tax_code,
        company_name: existingConfig.company_name,
        company_address: existingConfig.company_address || '',
        company_phone: existingConfig.company_phone || '',
        company_email: existingConfig.company_email || '',
        invoice_series: existingConfig.invoice_series || '',
        invoice_template: existingConfig.invoice_template || '',
        is_active: existingConfig.is_active,
        sandbox_mode: existingConfig.sandbox_mode,
      });
    }
  }, [existingConfig, form]);

  const selectedProvider = form.watch('provider');
  const providerInfo = EINVOICE_PROVIDERS.find(p => p.id === selectedProvider);
  const sandboxMode = form.watch('sandbox_mode');

  useEffect(() => {
    if (providerInfo) {
      form.setValue('provider_name', providerInfo.name);
      form.setValue('api_url', sandboxMode ? providerInfo.sandboxUrl : providerInfo.apiUrl);
    }
  }, [selectedProvider, sandboxMode, providerInfo, form]);

  const onSubmit = async (data: ConfigFormData) => {
    await saveConfig.mutateAsync({
      ...data,
      id: existingConfig?.id,
    });
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const result = await einvoiceAPI.mutateAsync({
        action: 'test-connection',
      });
      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Không thể kiểm tra kết nối',
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
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình nhà cung cấp HĐĐT</CardTitle>
          <CardDescription>
            Thiết lập kết nối với nhà cung cấp hoá đơn điện tử để phát hành hoá đơn hợp pháp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Provider Selection */}
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nhà cung cấp HĐĐT</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn nhà cung cấp" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EINVOICE_PROVIDERS.map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>
                              {provider.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="other">Khác</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sandbox_mode"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Chế độ thử nghiệm</FormLabel>
                        <FormDescription>
                          Sử dụng môi trường sandbox để test
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {providerInfo && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      Xem hướng dẫn đăng ký và tích hợp API của {providerInfo.name}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <a href={providerInfo.docUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Tài liệu API
                      </a>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* API Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Thông tin API</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="api_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://api.example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username / Account ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Tên đăng nhập API" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="api_key_encrypted"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>API Key / Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="API Key từ nhà cung cấp" {...field} />
                        </FormControl>
                        <FormDescription>
                          API Key sẽ được mã hoá và lưu trữ an toàn
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Thông tin doanh nghiệp</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="tax_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mã số thuế</FormLabel>
                        <FormControl>
                          <Input placeholder="0123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tên công ty</FormLabel>
                        <FormControl>
                          <Input placeholder="Công ty TNHH ABC" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_address"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Địa chỉ</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Đường ABC, Quận XYZ, TP. Hồ Chí Minh" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số điện thoại</FormLabel>
                        <FormControl>
                          <Input placeholder="0901234567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@company.vn" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Invoice Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Cài đặt hoá đơn</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="invoice_template"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mẫu số hoá đơn</FormLabel>
                        <FormControl>
                          <Input placeholder="01GTKT0/001" {...field} />
                        </FormControl>
                        <FormDescription>
                          Mẫu số được cấp bởi nhà cung cấp
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoice_series"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ký hiệu hoá đơn</FormLabel>
                        <FormControl>
                          <Input placeholder="1C24TAA" {...field} />
                        </FormControl>
                        <FormDescription>
                          Ký hiệu được đăng ký với cơ quan thuế
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Test Connection Result */}
              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={einvoiceAPI.isPending}
                >
                  {einvoiceAPI.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube2 className="h-4 w-4 mr-2" />
                  )}
                  Kiểm tra kết nối
                </Button>

                <Button type="submit" disabled={saveConfig.isPending}>
                  {saveConfig.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Lưu cấu hình
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle>Hướng dẫn đăng ký HĐĐT</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>
              <strong>Đăng ký tài khoản</strong> với một trong các nhà cung cấp HĐĐT được cấp phép (VNPT, Viettel, FPT, MISA...)
            </li>
            <li>
              <strong>Đăng ký mẫu hoá đơn</strong> với cơ quan thuế thông qua nhà cung cấp
            </li>
            <li>
              <strong>Nhận thông tin API</strong> (Username, API Key, Mẫu số, Ký hiệu) từ nhà cung cấp
            </li>
            <li>
              <strong>Điền thông tin</strong> vào form cấu hình phía trên
            </li>
            <li>
              <strong>Bật chế độ thử nghiệm</strong> để test trước khi đưa vào sử dụng thực tế
            </li>
            <li>
              <strong>Kiểm tra kết nối</strong> để đảm bảo API hoạt động đúng
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
