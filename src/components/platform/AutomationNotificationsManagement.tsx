import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useNotificationAutomations,
  useUpdateAutomation,
  useCreateAutomation,
  useDeleteAutomation,
  type NotificationAutomation,
} from '@/hooks/useNotificationAutomations';
import { Plus, Pencil, Trash2, Zap, Clock, Bell, Mail, MonitorSmartphone, Repeat, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const TRIGGER_LABELS: Record<string, string> = {
  new_signup: 'Đăng ký mới',
  inactive_1d: 'Chưa dùng sau 1 ngày',
  inactive_3d: 'Chưa dùng sau 3 ngày',
  inactive_7d: 'Chưa dùng sau 7 ngày',
  trial_expiring: 'Sắp hết dùng thử',
  low_stock: 'Cảnh báo tồn kho thấp',
};

const CHANNEL_LABELS: Record<string, { label: string; icon: typeof Bell }> = {
  bell: { label: 'Chuông', icon: Bell },
  popup: { label: 'Popup', icon: MonitorSmartphone },
  email: { label: 'Email', icon: Mail },
};

const FREQUENCY_LABELS: Record<string, string> = {
  once: '1 lần duy nhất',
  daily: 'Mỗi ngày',
  weekly: 'Mỗi tuần',
  monthly: 'Mỗi tháng',
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Tất cả tài khoản',
  active: 'Đang hoạt động',
  trial: 'Dùng thử',
  free: 'Miễn phí (hết hạn)',
  paid: 'Đã mua gói',
};

export function AutomationNotificationsManagement() {
  const { data: automations = [], isLoading } = useNotificationAutomations();
  const updateMutation = useUpdateAutomation();
  const createMutation = useCreateAutomation();
  const deleteMutation = useDeleteAutomation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationAutomation | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [triggerType, setTriggerType] = useState('new_signup');
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [channels, setChannels] = useState<string[]>(['bell']);
  const [sendFrequency, setSendFrequency] = useState('daily');
  const [targetAudience, setTargetAudience] = useState('all');

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setLinkUrl('');
    setButtonText('');
    setTriggerType('new_signup');
    setDelayMinutes(0);
    setChannels(['bell']);
    setSendFrequency('daily');
    setTargetAudience('all');
    setEditing(null);
  };

  const openEdit = (a: NotificationAutomation) => {
    setEditing(a);
    setTitle(a.title);
    setMessage(a.message);
    setLinkUrl(a.link_url || '');
    setButtonText(a.button_text || '');
    setTriggerType(a.trigger_type);
    setDelayMinutes(a.delay_minutes);
    setChannels(a.channels || ['bell']);
    setSendFrequency(a.send_frequency || 'daily');
    setTargetAudience(a.target_audience || 'all');
    setDialogOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const toggleChannel = (ch: string) => {
    setChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Vui lòng nhập tiêu đề và nội dung', variant: 'destructive' });
      return;
    }

    const payload = {
      title: title.trim(),
      message: message.trim(),
      link_url: linkUrl.trim() || null,
      button_text: buttonText.trim() || null,
      trigger_type: triggerType,
      delay_minutes: delayMinutes,
      channels,
      send_frequency: sendFrequency,
      target_audience: targetAudience,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
        toast({ title: 'Đã cập nhật automation' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Đã tạo automation mới' });
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa automation này?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Đã xóa' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggle = async (a: NotificationAutomation) => {
    await updateMutation.mutateAsync({ id: a.id, is_enabled: !a.is_enabled });
  };

  const formatDelay = (minutes: number) => {
    if (minutes < 60) return `${minutes} phút`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} giờ`;
    return `${Math.round(minutes / 1440)} ngày`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Automation thông báo</h3>
          <p className="text-xs text-muted-foreground">Tự động gửi thông báo dựa trên hành vi người dùng</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Thêm
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Đang tải...</div>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Zap className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Chưa có automation nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {automations.map(a => (
            <Card key={a.id} className={!a.is_enabled ? 'opacity-60' : ''}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Switch
                      checked={a.is_enabled}
                      onCheckedChange={() => handleToggle(a)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{a.title}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {TRIGGER_LABELS[a.trigger_type] || a.trigger_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {a.delay_minutes > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-3 w-3" /> Sau {formatDelay(a.delay_minutes)}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                        <Repeat className="h-3 w-3" /> {FREQUENCY_LABELS[a.send_frequency] || a.send_frequency}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                        <Users className="h-3 w-3" /> {AUDIENCE_LABELS[a.target_audience] || a.target_audience}
                      </Badge>
                      <div className="flex gap-1">
                        {(a.channels || []).map(ch => {
                          const info = CHANNEL_LABELS[ch];
                          if (!info) return null;
                          const Icon = info.icon;
                          return (
                            <Badge key={ch} variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                              <Icon className="h-3 w-3" /> {info.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa automation' : 'Tạo automation mới'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Trigger</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tiêu đề *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề thông báo" />
            </div>

            <div>
              <Label>Nội dung *</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Nội dung thông báo" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nút bấm</Label>
                <Input value={buttonText} onChange={e => setButtonText(e.target.value)} placeholder="Bắt đầu ngay" />
              </div>
              <div>
                <Label>Link</Label>
                <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="/import/new" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" /> Tần suất gửi
                </Label>
                <Select value={sendFrequency} onValueChange={setSendFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Đối tượng
                </Label>
                <Select value={targetAudience} onValueChange={setTargetAudience}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Độ trễ (phút)</Label>
              <Input type="number" value={delayMinutes} onChange={e => setDelayMinutes(Number(e.target.value))} min={0} />
              <p className="text-[10px] text-muted-foreground mt-1">0 = gửi ngay khi điều kiện thỏa</p>
            </div>

            <div>
              <Label>Kênh gửi</Label>
              <div className="flex gap-4 mt-2">
                {Object.entries(CHANNEL_LABELS).map(([key, { label, icon: Icon }]) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={channels.includes(key)}
                      onCheckedChange={() => toggleChannel(key)}
                    />
                    <Icon className="h-4 w-4" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Hủy</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Cập nhật' : 'Tạo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
