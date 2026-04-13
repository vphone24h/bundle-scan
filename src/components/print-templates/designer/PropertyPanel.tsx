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
  Plus, Copy, ArrowUp, ArrowDown,
} from 'lucide-react';
import { DYNAMIC_FIELDS, TABLE_FIELD_OPTIONS, type TemplateElement } from './types';

interface Props {
  element: TemplateElement | undefined;
  onUpdate: (id: string, updates: Partial<TemplateElement>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
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
              <div>
                <Label className="text-[10px]">Nội dung</Label>
                <Input className="h-7 text-xs" value={element.content || ''} onChange={(e) => onUpdate(element.id, { content: e.target.value })} />
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
          <>
            <Separator />
            <div>
              <Label className="text-[10px]">URL ảnh</Label>
              <Input className="h-7 text-xs" value={element.imageUrl || ''} onChange={(e) => onUpdate(element.id, { imageUrl: e.target.value })} placeholder="https://..." />
            </div>
          </>
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
