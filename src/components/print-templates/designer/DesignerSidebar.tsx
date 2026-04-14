import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Type, Image as ImageIcon, GripVertical, Table,
  Store, User, FileText, DollarSign, LayoutTemplate,
  Smartphone, ShoppingBag, Building, Truck, BookOpen,
} from 'lucide-react';
import { DYNAMIC_FIELDS, genId, type TemplateElement } from './types';
import { PRESET_BLOCKS, FULL_PAGE_PRESETS } from './presets';
import { KeywordPickerDialog } from './KeywordPickerDialog';

const ICON_MAP: Record<string, any> = {
  Store, User, FileText, DollarSign, LayoutTemplate, Table, Building, Truck,
};

const FULL_PRESET_ICONS = [Smartphone, ShoppingBag];

interface Props {
  onAddElement: (el: Omit<TemplateElement, 'id'>) => void;
  onAddPreset: (elements: Omit<TemplateElement, 'id'>[]) => void;
}

export function DesignerSidebar({ onAddElement, onAddPreset }: Props) {
  const [keywordOpen, setKeywordOpen] = useState(false);

  const handleKeywordSelect = (key: string, label: string) => {
    onAddElement({ type: 'dynamic', x: 10, y: 10, w: 40, h: 4, field: key, fontSize: 11, textAlign: 'left' });
  };

  return (
    <div className="w-full lg:w-56 shrink-0 space-y-3">
      {/* Full page presets */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 space-y-2">
          <p className="text-xs font-semibold text-primary uppercase">⚡ Mẫu hoàn chỉnh</p>
          <p className="text-[10px] text-muted-foreground">Nhấn để tải toàn bộ mẫu lên canvas</p>
          <div className="space-y-1.5">
            {FULL_PAGE_PRESETS.map((preset, i) => {
              const Icon = FULL_PRESET_ICONS[i] || FileText;
              return (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs justify-start h-auto py-2 border-primary/20"
                  onClick={() => onAddPreset(preset.elements)}
                >
                  <Icon className="h-3.5 w-3.5 mr-1.5 text-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{preset.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Thêm thành phần</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => onAddElement({ type: 'text', x: 10, y: 10, w: 40, h: 5, content: 'Nội dung', fontSize: 12, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', textTransform: 'none' })}>
              <Type className="h-3 w-3 mr-1" /> Chữ
            </Button>
            <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => onAddElement({ type: 'image', x: 10, y: 10, w: 30, h: 15 })}>
              <ImageIcon className="h-3 w-3 mr-1" /> Ảnh
            </Button>
            <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => onAddElement({ type: 'line', x: 5, y: 50, w: 190, h: 1 })}>
              <GripVertical className="h-3 w-3 mr-1 rotate-90" /> Đường kẻ
            </Button>
            <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => onAddElement({
              type: 'table', x: 5, y: 50, w: 190, h: 25,
              tableColumns: [
                { label: 'STT', field: 'line_stt', width: 8 },
                { label: 'Tên SP', field: 'line_variant', width: 40 },
                { label: 'SL', field: 'line_qty', width: 10 },
                { label: 'Đơn giá', field: 'line_price', width: 20 },
                { label: 'Thành tiền', field: 'line_amount', width: 22 },
              ],
            })}>
              <Table className="h-3 w-3 mr-1" /> Bảng SP
            </Button>
          </div>
          <Button
            variant="default"
            size="sm"
            className="w-full text-xs mt-1"
            onClick={() => setKeywordOpen(true)}
          >
            <BookOpen className="h-3 w-3 mr-1" /> Thêm từ khóa
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Biến dữ liệu</p>
          {DYNAMIC_FIELDS.map((group) => {
            const Icon = ICON_MAP[group.icon] || FileText;
            return (
              <div key={group.group}>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Icon className="h-3 w-3" /> {group.group}
                </p>
                <div className="flex flex-wrap gap-1">
                  {group.fields.map((f) => (
                    <Badge
                      key={f.key}
                      variant="secondary"
                      className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => onAddElement({ type: 'dynamic', x: 10, y: 10, w: 40, h: 4, field: f.key, fontSize: 11, textAlign: 'left' })}
                    >
                      {f.label}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Khối dựng sẵn</p>
          <div className="space-y-1">
            {PRESET_BLOCKS.map((preset) => {
              const Icon = ICON_MAP[preset.icon] || FileText;
              return (
                <Button key={preset.name} variant="outline" size="sm" className="w-full text-xs justify-start" onClick={() => onAddPreset(preset.elements)}>
                  <Icon className="h-3 w-3 mr-1.5" /> {preset.name}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <KeywordPickerDialog
        open={keywordOpen}
        onClose={() => setKeywordOpen(false)}
        onSelect={handleKeywordSelect}
      />
    </div>
  );
}
