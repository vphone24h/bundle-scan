import { useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Trash2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Plus, Copy, ArrowUp, ArrowDown, Upload, Loader2,
} from 'lucide-react';
import { DYNAMIC_FIELDS, TABLE_FIELD_OPTIONS, type TemplateElement } from './types';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  element: TemplateElement | undefined;
  onUpdate: (id: string, updates: Partial<TemplateElement>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

function ImageUploadSection({ element, onUpdate }: { element: TemplateElement; onUpdate: (id: string, u: Partial<TemplateElement>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `print-templates/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('tenant-assets').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
      onUpdate(element.id, { imageUrl: data.publicUrl });
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast({ title: 'Tải ảnh thất bại', description: err?.message || 'Vui lòng thử lại', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <Label className="text-[10px]">Ảnh</Label>
        {element.imageUrl && (
          <img src={element.imageUrl} alt="" className="w-full max-h-20 object-contain rounded border" />
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
            {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
          </Button>
        </div>
        <Input className="h-7 text-xs" value={element.imageUrl || ''} onChange={(e) => onUpdate(element.id, { imageUrl: e.target.value })} placeholder="Hoặc dán URL..." />
      </div>
    </>
  );
}

export function PropertyPanel({ element, onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown }: Props) {
  if (!element) {
    return (
      <Card>
        <CardContent className="p-3 text-center text-xs text-muted-foreground py-8">
          Click vào thành phần trên giấy để chỉnh sửa
        </CardContent>
      </Card>
    );
  }

  const typeLabel = element.type === 'text' ? 'Chữ' : element.type === 'dynamic' ? 'Biến' : element.type === 'image' ? 'Ảnh' : element.type === 'table' ? 'Bảng SP' : 'Đường kẻ';

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase">{typeLabel}</p>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMoveUp(element.id)} title="Đưa lên trên">
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMoveDown(element.id)} title="Đưa xuống dưới">
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDuplicate(element.id)} title="Nhân bản">
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(element.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Position */}
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y', 'w', 'h'] as const).map((prop) => (
            <div key={prop}>
              <Label className="text-[10px]">{prop.toUpperCase()}</Label>
              <Input type="number" className="h-7 text-xs" value={element[prop]} onChange={(e) => onUpdate(element.id, { [prop]: +e.target.value })} />
            </div>
          ))}
        </div>

        {/* Text properties */}
        {(element.type === 'text' || element.type === 'dynamic') && (
          <>
            <Separator />
            {element.type === 'text' && (
              <div className="space-y-1">
                <Label className="text-[10px]">Nội dung</Label>
                <textarea
                  className="w-full min-h-[60px] rounded-md border border-input bg-background px-2 py-1 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                  value={element.content || ''}
                  onChange={(e) => onUpdate(element.id, { content: e.target.value })}
                  rows={3}
                />
                <div className="flex gap-1 flex-wrap">
                  {['•', '–', '✓', '★', '▸', '■'].map((ch) => (
                    <Button key={ch} type="button" size="sm" variant="outline" className="h-6 w-6 p-0 text-xs"
                      onClick={() => onUpdate(element.id, { content: (element.content || '') + ch + ' ' })}>
                      {ch}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {element.type === 'dynamic' && (
              <div>
                <Label className="text-[10px]">Biến</Label>
                <Select value={element.field || ''} onValueChange={(v) => onUpdate(element.id, { field: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DYNAMIC_FIELDS.flatMap((g) => g.fields).map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-[10px]">Font chữ</Label>
              <Select value={element.fontFamily || ''} onValueChange={(v) => onUpdate(element.id, { fontFamily: v || undefined })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Mặc định (Arial)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Open Sans">Open Sans</SelectItem>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Lato">Lato</SelectItem>
                  <SelectItem value="Nunito">Nunito</SelectItem>
                  <SelectItem value="Be Vietnam Pro">Be Vietnam Pro</SelectItem>
                  <SelectItem value="Courier New">Courier New</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Verdana">Verdana</SelectItem>
                  <SelectItem value="Tahoma">Tahoma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Cỡ chữ</Label>
              <Input type="number" className="h-7 text-xs" value={element.fontSize || 12} onChange={(e) => onUpdate(element.id, { fontSize: +e.target.value })} />
            </div>
            <div className="flex gap-1">
              <Button variant={element.fontWeight === 'bold' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => onUpdate(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}>
                <Bold className="h-3 w-3" />
              </Button>
              <Button variant={element.fontStyle === 'italic' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => onUpdate(element.id, { fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}>
                <Italic className="h-3 w-3" />
              </Button>
              <Button variant={element.textDecoration === 'underline' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => onUpdate(element.id, { textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })}>
                <Underline className="h-3 w-3" />
              </Button>
              <div className="w-px bg-border mx-0.5" />
              <Button variant={element.textAlign === 'left' || !element.textAlign ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => onUpdate(element.id, { textAlign: 'left' })}>
                <AlignLeft className="h-3 w-3" />
              </Button>
              <Button variant={element.textAlign === 'center' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => onUpdate(element.id, { textAlign: 'center' })}>
                <AlignCenter className="h-3 w-3" />
              </Button>
              <Button variant={element.textAlign === 'right' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => onUpdate(element.id, { textAlign: 'right' })}>
                <AlignRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="uppercase" checked={element.textTransform === 'uppercase'} onChange={(e) => onUpdate(element.id, { textTransform: e.target.checked ? 'uppercase' : 'none' })} />
              <Label htmlFor="uppercase" className="text-[10px]">IN HOA</Label>
            </div>
          </>
        )}

        {/* Image */}
        {element.type === 'image' && (
          <ImageUploadSection element={element} onUpdate={onUpdate} />
        )}

        {/* Table config */}
        {element.type === 'table' && (
          <>
            <Separator />
            <p className="text-[10px] font-semibold text-muted-foreground">Cột bảng</p>
            {(element.tableColumns || []).map((col, i) => (
              <div key={i} className="flex gap-1 items-end">
                <div className="flex-1">
                  <Label className="text-[10px]">Tên</Label>
                  <Input className="h-7 text-xs" value={col.label} onChange={(e) => {
                    const cols = [...(element.tableColumns || [])];
                    cols[i] = { ...cols[i], label: e.target.value };
                    onUpdate(element.id, { tableColumns: cols });
                  }} />
                </div>
                <div className="w-20">
                  <Label className="text-[10px]">Field</Label>
                  <Select value={col.field} onValueChange={(v) => {
                    const cols = [...(element.tableColumns || [])];
                    cols[i] = { ...cols[i], field: v };
                    onUpdate(element.id, { tableColumns: cols });
                  }}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TABLE_FIELD_OPTIONS.map((f) => (<SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-12">
                  <Label className="text-[10px]">%</Label>
                  <Input type="number" className="h-7 text-xs" value={col.width} onChange={(e) => {
                    const cols = [...(element.tableColumns || [])];
                    cols[i] = { ...cols[i], width: +e.target.value };
                    onUpdate(element.id, { tableColumns: cols });
                  }} />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                  const cols = (element.tableColumns || []).filter((_, j) => j !== i);
                  onUpdate(element.id, { tableColumns: cols });
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
              const cols = [...(element.tableColumns || []), { label: 'Mới', field: 'line_stt', width: 10 }];
              onUpdate(element.id, { tableColumns: cols });
            }}>
              <Plus className="h-3 w-3 mr-1" /> Thêm cột
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
