import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  usePlatformEmailAutomations,
  useCreatePlatformEmailAutomation,
  useUpdatePlatformEmailAutomation,
  useDeletePlatformEmailAutomation,
  type PlatformEmailAutomation,
} from '@/hooks/usePlatformEmailAutomations';
import { Plus, Pencil, Trash2, Mail, Clock, Zap, Users, Eye, Send, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AutoEmailHistoryTable } from './AutoEmailHistoryTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TRIGGER_LABELS: Record<string, string> = {
  signup_days: 'Sau khi đăng ký X ngày',
  inactive_days: 'Không hoạt động X ngày',
  no_login_since: 'Sau X ngày không truy cập (gửi 1 lần)',
  post_purchase_days: 'Sau khi mua hàng X ngày (gửi 1 lần)',
  trial_expiring: 'Sắp hết dùng thử (còn X ngày)',
  no_import: 'Chưa nhập hàng sau X ngày',
  no_export: 'Chưa xuất hàng sau X ngày',
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Tất cả tài khoản',
  active: 'Đang hoạt động',
  trial: 'Đang dùng thử',
  free: 'Miễn phí (hết hạn)',
  paid: 'Đã mua gói',
};

const DEFAULT_TEMPLATES: Record<string, { subject: string; html_content: string }> = {
  signup_days: {
    subject: 'Chào mừng bạn đến với VKho! 🎉',
    html_content: '<h2>Xin chào {{tenant_name}}!</h2><p>Cảm ơn bạn đã đăng ký sử dụng VKho.</p><p>Bạn đã khám phá các tính năng quản lý kho, bán hàng và báo cáo chưa? Hãy bắt đầu ngay!</p><p><a href="https://vkho.vn">Truy cập VKho ngay →</a></p>',
  },
  inactive_days: {
    subject: 'VKho nhớ bạn! Quay lại nhé 👋',
    html_content: '<h2>Chào {{tenant_name}}!</h2><p>Chúng tôi nhận thấy bạn chưa đăng nhập gần đây. Có vấn đề gì không?</p><p>Hãy quay lại và tiếp tục quản lý cửa hàng của bạn nhé!</p><p><a href="https://vkho.vn">Đăng nhập ngay →</a></p>',
  },
  no_login_since: {
    subject: 'Bạn đã lâu không ghé VKho – Chúng tôi nhớ bạn! 💙',
    html_content: '<h2>Chào {{tenant_name}}!</h2><p>Đã hơn {{trigger_days}} ngày bạn chưa truy cập VKho. Cửa hàng của bạn vẫn đang chờ!</p><p>Đăng nhập ngay để kiểm tra tồn kho, doanh thu và các cập nhật mới nhất.</p><p><a href="https://vkho.vn">Quay lại VKho →</a></p><p style="color:#888;font-size:12px;">Email này chỉ gửi một lần duy nhất để tránh làm phiền bạn.</p>',
  },
  trial_expiring: {
    subject: 'Gói dùng thử sắp hết hạn ⏰',
    html_content: '<h2>Chào {{tenant_name}}!</h2><p>Gói dùng thử của bạn sẽ hết hạn sớm. Nâng cấp ngay để tiếp tục sử dụng đầy đủ tính năng!</p><p><a href="https://vkho.vn/subscription">Xem các gói →</a></p>',
  },
  no_import: {
    subject: 'Bạn chưa nhập hàng – Bắt đầu ngay! 📦',
    html_content: '<h2>Chào {{tenant_name}}!</h2><p>Bạn vẫn chưa thử tính năng Nhập hàng. Hãy bắt đầu nhập sản phẩm đầu tiên để quản lý kho hiệu quả!</p>',
  },
  no_export: {
    subject: 'Bạn chưa xuất hàng – Thử ngay! 🛒',
    html_content: '<h2>Chào {{tenant_name}}!</h2><p>Tính năng Xuất hàng giúp bạn ghi nhận doanh thu nhanh chóng. Hãy thử ngay!</p>',
  },
  post_purchase_days: {
    subject: 'Cảm ơn bạn đã sử dụng VKho! 🎉',
    html_content: '<h2>Chào {{tenant_name}}!</h2><p>Cảm ơn bạn đã thực hiện giao dịch bán hàng trên VKho. Hy vọng bạn hài lòng với trải nghiệm!</p><p>Hãy tiếp tục khám phá các tính năng báo cáo, quản lý kho và chăm sóc khách hàng nhé.</p><p><a href="https://vkho.vn">Truy cập VKho →</a></p><p style="color:#888;font-size:12px;">Email này chỉ gửi một lần duy nhất.</p>',
  },
};

export function PlatformEmailAutomationManagement() {
  const { data: automations = [], isLoading } = usePlatformEmailAutomations();
  const createMutation = useCreatePlatformEmailAutomation();
  const updateMutation = useUpdatePlatformEmailAutomation();
  const deleteMutation = useDeletePlatformEmailAutomation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformEmailAutomation | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sendingTestId, setSendingTestId] = useState<string | null>(null);
  const [runningNow, setRunningNow] = useState(false);
  const [runningSingleId, setRunningSingleId] = useState<string | null>(null);
  // Form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('signup_days');
  const [triggerDays, setTriggerDays] = useState(7);
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');

  const resetForm = () => {
    setName('');
    setTriggerType('signup_days');
    setTriggerDays(7);
    setSubject('');
    setHtmlContent('');
    setTargetAudience('all');
    setEditing(null);
  };

  const openEdit = (a: PlatformEmailAutomation) => {
    setEditing(a);
    setName(a.name);
    setTriggerType(a.trigger_type);
    setTriggerDays(a.trigger_days);
    setSubject(a.subject);
    setHtmlContent(a.html_content);
    setTargetAudience(a.target_audience);
    setDialogOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const applyTemplate = () => {
    const tpl = DEFAULT_TEMPLATES[triggerType];
    if (tpl) {
      setSubject(tpl.subject);
      setHtmlContent(tpl.html_content);
    }
  };

  const formatPreviewHtml = (content: string) => {
    const hasHtmlBlocks = /<(p|div|br|ul|ol|li|h[1-6]|table)/i.test(content);
    return hasHtmlBlocks ? content : content.replace(/\r\n|\r|\n/g, '<br>');
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) return;
    const payload = {
      name: name.trim(),
      trigger_type: triggerType,
      trigger_days: triggerDays,
      subject: subject.trim(),
      html_content: htmlContent,
      target_audience: targetAudience,
    };
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa kịch bản email này?')) return;
    await deleteMutation.mutateAsync(id);
  };

  const handleToggle = async (a: PlatformEmailAutomation) => {
    await updateMutation.mutateAsync({ id: a.id, is_enabled: !a.is_enabled });
  };

  const handleSendTest = async (a: PlatformEmailAutomation) => {
    setSendingTestId(a.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('Không tìm thấy email admin');
        return;
      }

      // Replace template variables with sample/admin data for test
      const replaceVars = (text: string) =>
        text
          .replace(/\{\{tenant_name\}\}/g, 'Cửa hàng Demo')
          .replace(/\{\{email\}\}/g, user.email || '')
          .replace(/\{\{phone\}\}/g, '0901234567')
          .replace(/\{\{store_name\}\}/g, 'demo-store')
          .replace(/\{\{trigger_days\}\}/g, String(a.trigger_days));

      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          emails: [user.email],
          subject: `[TEST] ${replaceVars(a.subject)}`,
          htmlContent: replaceVars(a.html_content),
        },
      });

      if (error) {
        let message = error.message;
        try {
          const payload = await error.context?.json();
          if (payload?.error) message = payload.error;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      if ((data?.failed || 0) > 0) {
        const firstError = data?.errors?.[0] || 'Không thể gửi email test (SMTP đang bị giới hạn tạm thời)';
        throw new Error(firstError);
      }

      toast.success(`Đã gửi mail test đến ${user.email}`);
    } catch (err: any) {
      toast.error('Lỗi gửi test: ' + err.message);
    } finally {
      setSendingTestId(null);
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const { error } = await supabase.functions.invoke('run-platform-email-automations');
      if (error) throw error;
      toast.success('Đã chạy email automation thành công!');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      toast.error('Lỗi chạy automation: ' + err.message);
    } finally {
      setRunningNow(false);
    }
  };

  const handleRunSingle = async (a: PlatformEmailAutomation) => {
    setRunningSingleId(a.id);
    try {
      const { error } = await supabase.functions.invoke('run-platform-email-automations', {
        body: { automation_id: a.id },
      });
      if (error) throw error;
      toast.success(`Đã chạy kịch bản "${a.name}" thành công!`);
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setRunningSingleId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="scenarios">
        <TabsList className="mb-4">
          <TabsTrigger value="scenarios" className="text-xs sm:text-sm">
            <Zap className="h-3 w-3 mr-1" /> Kịch bản
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs sm:text-sm">
            <Mail className="h-3 w-3 mr-1" /> Lịch sử gửi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">Email Automation</h3>
              <p className="text-xs text-muted-foreground">Tự động gửi email chăm sóc khách hàng theo điều kiện</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleRunNow} disabled={runningNow}>
                <Play className={`h-4 w-4 mr-1 ${runningNow ? 'animate-spin' : ''}`} /> {runningNow ? 'Đang chạy...' : 'Chạy ngay'}
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Thêm kịch bản
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Đang tải...</div>
          ) : automations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Chưa có kịch bản email nào</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {automations.map(a => (
                <Card key={a.id} className={!a.is_enabled ? 'opacity-60' : ''}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <Switch checked={a.is_enabled} onCheckedChange={() => handleToggle(a)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{a.name}</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {TRIGGER_LABELS[a.trigger_type] || a.trigger_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.subject}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-3 w-3" /> {a.trigger_days} ngày
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Users className="h-3 w-3" /> {AUDIENCE_LABELS[a.target_audience] || a.target_audience}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600"
                          onClick={() => handleRunSingle(a)}
                          disabled={runningSingleId === a.id}
                          title="Chạy kịch bản này ngay"
                        >
                          <Play className={`h-4 w-4 ${runningSingleId === a.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary"
                          onClick={() => handleSendTest(a)}
                          disabled={sendingTestId === a.id}
                          title="Gửi mail test đến admin"
                        >
                          <Send className={`h-4 w-4 ${sendingTestId === a.id ? 'animate-pulse' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewHtml(a.html_content)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <AutoEmailHistoryTable />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa kịch bản' : 'Tạo kịch bản email mới'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Tên kịch bản *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Chào mừng khách mới" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Điều kiện gửi</Label>
                <Select value={triggerType} onValueChange={(v) => { setTriggerType(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Số ngày</Label>
                <Input type="number" value={triggerDays} onChange={e => setTriggerDays(Number(e.target.value))} min={1} />
              </div>
            </div>
            {(triggerType === 'no_login_since' || triggerType === 'post_purchase_days') && (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
                ⚠️ Điều kiện này chỉ gửi <strong>duy nhất 1 lần</strong> cho mỗi tài khoản để tránh spam.
              </p>
            )}

            <div>
              <Label>Đối tượng nhận</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AUDIENCE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Nội dung email</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={applyTemplate}>
                  📝 Dùng mẫu có sẵn
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">
                Biến hỗ trợ: {'{{tenant_name}}'}, {'{{email}}'}, {'{{phone}}'}, {'{{store_name}}'}
              </p>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Tiêu đề email *</Label>
                  <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Tiêu đề email" />
                </div>
                <div>
                  <Label className="text-xs">Nội dung HTML</Label>
                  <Textarea
                    value={htmlContent}
                    onChange={e => setHtmlContent(e.target.value)}
                    placeholder="<h2>Xin chào {{tenant_name}}!</h2><p>Nội dung email...</p>"
                    rows={8}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Hủy</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Cập nhật' : 'Tạo kịch bản'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Xem trước email</DialogTitle>
          </DialogHeader>
          {previewHtml && (
            <div
              className="border rounded-lg p-4 bg-white text-sm prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: formatPreviewHtml(previewHtml) }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
