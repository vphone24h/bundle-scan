import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollableTableWrapper } from '@/components/ui/scrollable-table-wrapper';
import { Plus, Pencil, Trash2, Mail, Eye, Send, Clock, CheckCircle, XCircle, Loader2, GripVertical, Type, AlignLeft, Image, MousePointer, Minus, MoveVertical, Phone, MessageCircle, MapPin, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import { useCurrentTenant } from '@/hooks/useTenant';
import {
  useEmailAutomations,
  useEmailAutomationBlocks,
  useEmailAutomationLogs,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
  useSaveBlocks,
  EmailAutomation,
  EmailAutomationBlock,
} from '@/hooks/useEmailAutomations';
import { EmailTemplatePickerDialog, EmailTemplatePreset } from './EmailTemplatePickerDialog';

const TRIGGER_TYPES = [
  { value: 'days_after_purchase', label: 'Sau khi mua hàng (ngày)' },
  { value: 'days_before_warranty_expires', label: 'Trước khi hết bảo hành (ngày)' },
  { value: 'days_inactive', label: 'Không mua hàng trong (ngày)' },
];

const BLOCK_TYPES = [
  { value: 'heading', label: 'Tiêu đề', icon: Type },
  { value: 'text', label: 'Đoạn văn', icon: AlignLeft },
  { value: 'image', label: 'Hình ảnh', icon: Image },
  { value: 'button', label: 'Nút bấm', icon: MousePointer },
  { value: 'divider', label: 'Đường kẻ', icon: Minus },
  { value: 'spacer', label: 'Khoảng cách', icon: MoveVertical },
];

const BUTTON_PRESETS = [
  { label: '📞 Gọi điện', url: 'tel:', icon: Phone },
  { label: '💬 Chat Zalo', url: 'https://zalo.me/', icon: MessageCircle },
  { label: '📍 Xem địa chỉ', url: 'https://maps.google.com/', icon: MapPin },
  { label: '🛒 Xem sản phẩm', url: '/', icon: ExternalLink },
];

const VARIABLES = [
  { key: '{{customer_name}}', label: 'Tên khách hàng' },
  { key: '{{product_name}}', label: 'Tên sản phẩm' },
  { key: '{{purchase_date}}', label: 'Ngày mua hàng' },
  { key: '{{warranty_end}}', label: 'Hạn bảo hành' },
  { key: '{{store_name}}', label: 'Tên cửa hàng' },
];

interface BlockItem {
  tempId: string;
  block_type: string;
  content: any;
}

function newBlock(type: string): BlockItem {
  const base = { tempId: crypto.randomUUID(), block_type: type, content: {} };
  switch (type) {
    case 'heading': return { ...base, content: { text: 'Tiêu đề email', level: 'h2' } };
    case 'text': return { ...base, content: { text: 'Xin chào {{customer_name}}, cảm ơn bạn đã mua hàng tại cửa hàng chúng tôi.' } };
    case 'image': return { ...base, content: { url: '', alt: 'Hình ảnh' } };
    case 'button': return { ...base, content: { text: 'Liên hệ ngay', url: '#', color: '#1a56db' } };
    case 'divider': return { ...base, content: {} };
    case 'spacer': return { ...base, content: { height: 20 } };
    default: return base;
  }
}

function renderBlockPreview(block: BlockItem) {
  const { block_type, content } = block;
  switch (block_type) {
    case 'heading':
      return <h2 style={{ fontSize: content.level === 'h1' ? 24 : 20, fontWeight: 700, margin: '8px 0' }}>{content.text || 'Tiêu đề'}</h2>;
    case 'text':
      return <p style={{ fontSize: 14, lineHeight: 1.6, margin: '4px 0', color: '#374151' }}>{content.text || 'Nội dung...'}</p>;
    case 'image':
      return content.url ? <img src={content.url} alt={content.alt} style={{ maxWidth: '100%', borderRadius: 8 }} /> : <div className="h-24 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">Chưa có ảnh</div>;
    case 'button':
      return <div style={{ textAlign: 'center', margin: '12px 0' }}><span style={{ display: 'inline-block', padding: '10px 24px', background: content.color || '#1a56db', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{content.text || 'Nút bấm'}</span></div>;
    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />;
    case 'spacer':
      return <div style={{ height: content.height || 20 }} />;
    default:
      return null;
  }
}

// === Block Editor ===
function BlockEditor({ block, onChange, onRemove }: { block: BlockItem; onChange: (b: BlockItem) => void; onRemove: () => void }) {
  const { block_type, content } = block;

  const update = (partial: any) => onChange({ ...block, content: { ...content, ...partial } });

  return (
    <div className="border rounded-lg p-3 bg-card space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <Badge variant="outline" className="text-xs">
            {BLOCK_TYPES.find(b => b.value === block_type)?.label || block_type}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {block_type === 'heading' && (
        <div className="space-y-2">
          <Input value={content.text || ''} onChange={e => update({ text: e.target.value })} placeholder="Tiêu đề..." />
          <Select value={content.level || 'h2'} onValueChange={v => update({ level: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="h1">H1 - Lớn</SelectItem>
              <SelectItem value="h2">H2 - Vừa</SelectItem>
              <SelectItem value="h3">H3 - Nhỏ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {block_type === 'text' && (
        <textarea
          className="w-full min-h-[80px] p-2 border rounded text-sm bg-background resize-y"
          value={content.text || ''}
          onChange={e => update({ text: e.target.value })}
          placeholder="Nội dung email..."
        />
      )}

      {block_type === 'image' && (
        <div className="space-y-2">
          <Input value={content.url || ''} onChange={e => update({ url: e.target.value })} placeholder="URL hình ảnh..." />
          <Input value={content.alt || ''} onChange={e => update({ alt: e.target.value })} placeholder="Mô tả ảnh (alt)..." />
        </div>
      )}

      {block_type === 'button' && (
        <div className="space-y-2">
          <Input value={content.text || ''} onChange={e => update({ text: e.target.value })} placeholder="Nội dung nút..." />
          <Input value={content.url || ''} onChange={e => update({ url: e.target.value })} placeholder="Đường dẫn (URL)..." />
          <div className="flex items-center gap-2">
            <Label className="text-xs">Màu:</Label>
            <input type="color" value={content.color || '#1a56db'} onChange={e => update({ color: e.target.value })} className="h-8 w-10 rounded border cursor-pointer" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BUTTON_PRESETS.map(p => (
              <Button key={p.label} variant="outline" size="sm" className="text-xs h-7" onClick={() => update({ text: p.label, url: p.url })}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {block_type === 'spacer' && (
        <div className="flex items-center gap-2">
          <Label className="text-xs">Chiều cao (px):</Label>
          <Input type="number" value={content.height || 20} onChange={e => update({ height: Number(e.target.value) })} className="w-20" />
        </div>
      )}
    </div>
  );
}

// === Scenario Form Dialog ===
function AutomationFormDialog({
  open, onOpenChange, automation, tenantId, prefilledTemplate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  automation: EmailAutomation | null;
  tenantId: string;
  prefilledTemplate?: EmailTemplatePreset | null;
}) {
  const isEdit = !!automation;
  const createMut = useCreateAutomation();
  const updateMut = useUpdateAutomation();
  const saveBlocksMut = useSaveBlocks();
  const { data: existingBlocks } = useEmailAutomationBlocks(automation?.id || null);

  const [name, setName] = useState(automation?.name || prefilledTemplate?.name || '');
  const [triggerType, setTriggerType] = useState(automation?.trigger_type || prefilledTemplate?.triggerType || 'days_after_purchase');
  const [triggerDays, setTriggerDays] = useState(automation?.trigger_days || prefilledTemplate?.triggerDays || 7);
  const [subject, setSubject] = useState(automation?.subject || prefilledTemplate?.subject || '');
  const [isActive, setIsActive] = useState(automation?.is_active || false);
  const [blocks, setBlocks] = useState<BlockItem[]>(
    prefilledTemplate?.blocks?.map(b => ({ tempId: crypto.randomUUID(), block_type: b.block_type, content: b.content })) || []
  );
  const [blocksLoaded, setBlocksLoaded] = useState(!!prefilledTemplate);
  const [showPreview, setShowPreview] = useState(false);

  // Load existing blocks when editing
  if (isEdit && existingBlocks && !blocksLoaded) {
    setBlocks(existingBlocks.map(b => ({ tempId: b.id, block_type: b.block_type, content: b.content })));
    setBlocksLoaded(true);
  }

  // Reset on open
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setBlocksLoaded(false);
      setBlocks([]);
    }
    onOpenChange(o);
  };

  const addBlock = (type: string) => {
    setBlocks(prev => [...prev, newBlock(type)]);
  };

  const updateBlock = (idx: number, b: BlockItem) => {
    setBlocks(prev => prev.map((bl, i) => i === idx ? b : bl));
  };

  const removeBlock = (idx: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== idx));
  };

  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    setBlocks(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Vui lòng nhập tên kịch bản'); return; }
    if (!subject.trim()) { toast.error('Vui lòng nhập tiêu đề email'); return; }

    try {
      let automationId = automation?.id;
      if (isEdit) {
        await updateMut.mutateAsync({ id: automation!.id, name, trigger_type: triggerType, trigger_days: triggerDays, subject, is_active: isActive });
      } else {
        const result = await createMut.mutateAsync({ tenant_id: tenantId, name, trigger_type: triggerType, trigger_days: triggerDays, subject, is_active: isActive });
        automationId = result.id;
      }

      await saveBlocksMut.mutateAsync({
        automationId: automationId!,
        blocks: blocks.map((b, i) => ({ automation_id: automationId!, block_type: b.block_type, content: b.content, display_order: i })),
      });

      handleOpenChange(false);
    } catch (e) {
      // errors handled by mutations
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending || saveBlocksMut.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa kịch bản' : 'Tạo kịch bản mới'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Settings */}
          <div className="grid gap-3">
            <div>
              <Label>Tên kịch bản</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Chăm sóc sau mua 7 ngày" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Điều kiện gửi</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Số ngày</Label>
                <Input type="number" min={1} value={triggerDays} onChange={e => setTriggerDays(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <Label>Tiêu đề email (Subject)</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="VD: Cảm ơn bạn đã mua hàng tại {{store_name}}" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Kích hoạt kịch bản</Label>
            </div>
          </div>

          {/* Variables reference */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Biến tự động có thể dùng:</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <Badge key={v.key} variant="secondary" className="text-xs cursor-pointer" onClick={() => navigator.clipboard.writeText(v.key).then(() => toast.success(`Đã copy ${v.key}`))}>
                  {v.key} = {v.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Email Content Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Nội dung email</Label>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                {showPreview ? 'Ẩn xem trước' : 'Xem trước'}
              </Button>
            </div>

            {showPreview ? (
              <div className="border rounded-lg p-6 bg-white max-w-lg mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
                {blocks.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm">Chưa có nội dung</p>
                ) : (
                  blocks.map((b, i) => <div key={b.tempId}>{renderBlockPreview(b)}</div>)
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {blocks.map((block, idx) => (
                  <div key={block.tempId} className="flex gap-1 items-start">
                    <div className="flex flex-col gap-0.5 pt-2">
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(idx, idx - 1)} disabled={idx === 0}>▲</Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(idx, idx + 1)} disabled={idx === blocks.length - 1}>▼</Button>
                    </div>
                    <div className="flex-1">
                      <BlockEditor block={block} onChange={b => updateBlock(idx, b)} onRemove={() => removeBlock(idx)} />
                    </div>
                  </div>
                ))}

                {/* Add block buttons */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {BLOCK_TYPES.map(bt => (
                    <Button key={bt.value} variant="outline" size="sm" className="text-xs gap-1" onClick={() => addBlock(bt.value)}>
                      <bt.icon className="h-3.5 w-3.5" />
                      {bt.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isEdit ? 'Cập nhật' : 'Tạo kịch bản'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// === Main Tab ===
export function EmailAutomationTab() {
  const { data: tenant } = useCurrentTenant();
  const { data: automations, isLoading } = useEmailAutomations();
  const { data: logs } = useEmailAutomationLogs();
  const updateMut = useUpdateAutomation();
  const deleteMut = useDeleteAutomation();

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<EmailAutomation | null>(null);
  const [tab, setTab] = useState('scenarios');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prefilledTemplate, setPrefilledTemplate] = useState<EmailTemplatePreset | null>(null);

  const handleEdit = (item: EmailAutomation) => {
    setEditItem(item);
    setPrefilledTemplate(null);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setPickerOpen(true);
  };

  const handleSelectTemplate = (tpl: EmailTemplatePreset) => {
    setEditItem(null);
    setPrefilledTemplate(tpl);
    setFormOpen(true);
  };

  const handleCreateManual = () => {
    setEditItem(null);
    setPrefilledTemplate(null);
    setFormOpen(true);
  };

  const handleToggle = (item: EmailAutomation) => {
    updateMut.mutate({ id: item.id, is_active: !item.is_active });
  };

  const handleDelete = (item: EmailAutomation) => {
    if (confirm(`Xóa kịch bản "${item.name}"?`)) {
      deleteMut.mutate(item.id);
    }
  };

  const handleSendTest = async (item: EmailAutomation) => {
    try {
      const { data: { user } } = await (await import('@/integrations/supabase/client')).supabase.auth.getUser();
      if (!user?.email) { toast.error('Không tìm thấy email của bạn'); return; }

      const { error } = await (await import('@/integrations/supabase/client')).supabase.functions.invoke('run-email-automations', {
        body: { testMode: true, automationId: item.id, testEmail: user.email },
      });
      if (error) throw error;
      toast.success(`Email thử đã gửi đến ${user.email}`);
    } catch (e: any) {
      toast.error('Lỗi gửi thử: ' + e.message);
    }
  };

  if (!tenant?.id) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5" />
            Email Automation
          </CardTitle>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" /> Tạo kịch bản
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="scenarios">Kịch bản ({automations?.length || 0})</TabsTrigger>
            <TabsTrigger value="logs">Lịch sử gửi ({logs?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !automations?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Chưa có kịch bản nào</p>
                <p className="text-sm mt-1">Tạo kịch bản để tự động gửi email chăm sóc khách hàng</p>
                <Button className="mt-4" onClick={handleCreate}><Plus className="h-4 w-4 mr-1" />Tạo kịch bản đầu tiên</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {automations.map(a => (
                  <div key={a.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium truncate">{a.name}</h4>
                        <Badge variant={a.is_active ? 'default' : 'secondary'}>
                          {a.is_active ? 'Đang bật' : 'Tắt'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {TRIGGER_TYPES.find(t => t.value === a.trigger_type)?.label || a.trigger_type}: <strong>{a.trigger_days} ngày</strong>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Subject: {a.subject}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Switch checked={a.is_active} onCheckedChange={() => handleToggle(a)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSendTest(a)} title="Gửi thử">
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(a)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            {!logs?.length ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Chưa có email nào được gửi</p>
            ) : (
              <ScrollableTableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>Tiêu đề</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: vi })}
                        </TableCell>
                        <TableCell className="text-sm">{log.customer_email}</TableCell>
                        <TableCell className="text-sm">{log.customer_name || '-'}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{log.subject}</TableCell>
                        <TableCell>
                          {log.status === 'sent' ? (
                            <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Đã gửi</Badge>
                          ) : log.status === 'failed' ? (
                            <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Lỗi</Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Đang gửi</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableWrapper>
            )}
          </TabsContent>
        </Tabs>

        <EmailTemplatePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelectTemplate={handleSelectTemplate}
          onCreateManual={handleCreateManual}
        />

        {formOpen && (
          <AutomationFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            automation={editItem}
            tenantId={tenant.id}
            prefilledTemplate={prefilledTemplate}
          />
        )}
      </CardContent>
    </Card>
  );
}
