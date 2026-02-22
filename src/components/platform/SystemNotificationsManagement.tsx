import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useAllSystemNotifications,
  useCreateSystemNotification,
  useUpdateSystemNotification,
  useDeleteSystemNotification,
  type SystemNotification,
} from '@/hooks/useSystemNotifications';
import { Plus, Pencil, Trash2, Pin, Eye, EyeOff, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  info: 'Thông tin',
  article: 'Bài viết / Link',
  popup: 'Popup chi tiết',
  startup: 'Popup mở app',
};

export function SystemNotificationsManagement() {
  const { data: notifications = [], isLoading } = useAllSystemNotifications();
  const createMutation = useCreateSystemNotification();
  const updateMutation = useUpdateSystemNotification();
  const deleteMutation = useDeleteSystemNotification();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<SystemNotification | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [fullContent, setFullContent] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'article' | 'popup' | 'startup'>('info');
  const [linkUrl, setLinkUrl] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [showAsStartup, setShowAsStartup] = useState(false);

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setFullContent('');
    setNotificationType('info');
    setLinkUrl('');
    setIsPinned(false);
    setIsActive(true);
    setShowAsStartup(false);
    setEditingNotification(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (n: SystemNotification) => {
    setEditingNotification(n);
    setTitle(n.title);
    setMessage(n.message);
    setFullContent(n.full_content || '');
    setNotificationType(n.notification_type);
    setLinkUrl(n.link_url || '');
    setIsPinned(n.is_pinned);
    setIsActive(n.is_active);
    setShowAsStartup(n.show_as_startup_popup);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Vui lòng nhập tiêu đề và nội dung', variant: 'destructive' });
      return;
    }

    const payload = {
      title: title.trim(),
      message: message.trim(),
      full_content: fullContent.trim() || null,
      notification_type: notificationType,
      link_url: linkUrl.trim() || null,
      is_pinned: isPinned,
      is_active: isActive,
      show_as_startup_popup: showAsStartup,
    };

    try {
      if (editingNotification) {
        await updateMutation.mutateAsync({ id: editingNotification.id, ...payload });
        toast({ title: 'Đã cập nhật thông báo' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Đã tạo thông báo mới' });
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa thông báo này?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Đã xóa thông báo' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (n: SystemNotification) => {
    await updateMutation.mutateAsync({ id: n.id, is_active: !n.is_active });
  };

  const handleTogglePin = async (n: SystemNotification) => {
    await updateMutation.mutateAsync({ id: n.id, is_pinned: !n.is_pinned });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Thông báo hệ thống</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Tạo thông báo
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Đang tải...</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Chưa có thông báo nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} className={!n.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {n.is_pinned && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          <Pin className="h-3 w-3 mr-0.5" /> Ghim
                        </Badge>
                      )}
                      {n.show_as_startup_popup && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Popup mở app</Badge>
                      )}
                      <Badge variant={n.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {n.is_active ? 'Đang hiển thị' : 'Đã ẩn'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {NOTIFICATION_TYPE_LABELS[n.notification_type] || n.notification_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(n.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTogglePin(n)} title={n.is_pinned ? 'Bỏ ghim' : 'Ghim'}>
                      <Pin className={`h-4 w-4 ${n.is_pinned ? 'text-amber-500' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(n)} title={n.is_active ? 'Ẩn' : 'Hiện'}>
                      {n.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(n)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(n.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingNotification ? 'Sửa thông báo' : 'Tạo thông báo mới'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Tiêu đề *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề thông báo" />
            </div>
            <div>
              <Label>Nội dung ngắn *</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Mô tả ngắn" rows={2} />
            </div>
            <div>
              <Label>Loại thông báo</Label>
              <Select value={notificationType} onValueChange={(v) => setNotificationType(v as 'info' | 'article' | 'popup' | 'startup')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Thông tin chung</SelectItem>
                  <SelectItem value="article">Bài viết / Link</SelectItem>
                  <SelectItem value="popup">Popup chi tiết</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(notificationType === 'article') && (
              <div>
                <Label>Link URL</Label>
                <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}
            {notificationType === 'popup' && (
              <div>
                <Label>Nội dung chi tiết (HTML)</Label>
                <Textarea value={fullContent} onChange={e => setFullContent(e.target.value)} placeholder="Nội dung HTML..." rows={4} />
              </div>
            )}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={isPinned} onCheckedChange={setIsPinned} />
                <Label>Ghim quan trọng</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Đang hiển thị</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showAsStartup} onCheckedChange={setShowAsStartup} />
              <Label>Hiện popup khi mở app (tối đa 1 lần/ngày)</Label>
            </div>
            {showAsStartup && (
              <div>
                <Label>Link khi nhấn "Xem ngay"</Label>
                <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Hủy</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingNotification ? 'Cập nhật' : 'Tạo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
