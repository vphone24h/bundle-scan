import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Save,
  Type,
  Image as ImageIcon,
  Hash,
  Store,
  User,
  FileText,
  DollarSign,
  Table,
  Trash2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  GripVertical,
  LayoutTemplate,
  Plus,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useCustomPrintTemplates,
  useUpdateCustomPrintTemplate,
  type CustomPrintTemplate,
} from '@/hooks/useCustomPrintTemplates';

// ========== TYPES ==========

export interface TemplateElement {
  id: string;
  type: 'text' | 'image' | 'dynamic' | 'table' | 'line';
  x: number; // grid units (0-199)
  y: number; // grid units (0-99)
  w: number; // grid units
  h: number; // grid units
  content?: string;
  field?: string; // dynamic field key
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'left' | 'center' | 'right';
  textTransform?: 'none' | 'uppercase';
  imageUrl?: string;
  // Table config
  tableColumns?: { label: string; field: string; width: number }[];
}

const PAPER_SIZES = {
  A4: { width: 210, height: 297, label: 'A4 (210×297mm)' },
  A5: { width: 148, height: 210, label: 'A5 (148×210mm)' },
};

const GRID_COLS = 200;
const GRID_ROWS = 100;

const DYNAMIC_FIELDS = [
  { group: 'Shop', icon: Store, fields: [
    { key: 'store_name', label: 'Tên cửa hàng' },
    { key: 'store_phone', label: 'SĐT cửa hàng' },
    { key: 'store_address', label: 'Địa chỉ cửa hàng' },
  ]},
  { group: 'Đơn hàng', icon: FileText, fields: [
    { key: 'created_on', label: 'Ngày tạo' },
    { key: 'invoice_code', label: 'Mã hoá đơn' },
    { key: 'staff_name', label: 'Nhân viên' },
    { key: 'location_name', label: 'Chi nhánh' },
  ]},
  { group: 'Khách hàng', icon: User, fields: [
    { key: 'customer_name', label: 'Tên khách' },
    { key: 'customer_phone', label: 'SĐT khách' },
    { key: 'billing_address', label: 'Địa chỉ khách' },
  ]},
  { group: 'Tổng tiền', icon: DollarSign, fields: [
    { key: 'total', label: 'Tổng tiền' },
    { key: 'paid_amount', label: 'Đã thanh toán' },
    { key: 'debt', label: 'Còn nợ' },
    { key: 'discount', label: 'Giảm giá' },
  ]},
];

const TABLE_FIELD_OPTIONS = [
  { key: 'line_stt', label: 'STT' },
  { key: 'line_variant', label: 'Tên SP' },
  { key: 'serials', label: 'IMEI/Serial' },
  { key: 'line_qty', label: 'SL' },
  { key: 'line_price', label: 'Đơn giá' },
  { key: 'line_amount', label: 'Thành tiền' },
  { key: 'line_warranty', label: 'Bảo hành' },
];

const PRESET_BLOCKS: { name: string; icon: any; elements: Omit<TemplateElement, 'id'>[] }[] = [
  {
    name: 'Header (Logo + Shop)',
    icon: LayoutTemplate,
    elements: [
      { type: 'dynamic', x: 5, y: 2, w: 90, h: 6, field: 'store_name', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
      { type: 'dynamic', x: 5, y: 8, w: 90, h: 4, field: 'store_address', fontSize: 11, textAlign: 'center' },
      { type: 'dynamic', x: 5, y: 12, w: 90, h: 4, field: 'store_phone', fontSize: 11, textAlign: 'center' },
    ],
  },
  {
    name: 'Thông tin đơn hàng',
    icon: FileText,
    elements: [
      { type: 'text', x: 5, y: 20, w: 90, h: 5, content: 'HOÁ ĐƠN BÁN HÀNG', fontSize: 18, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
      { type: 'dynamic', x: 5, y: 26, w: 45, h: 4, field: 'invoice_code', fontSize: 11 },
      { type: 'dynamic', x: 50, y: 26, w: 45, h: 4, field: 'created_on', fontSize: 11, textAlign: 'right' },
      { type: 'dynamic', x: 5, y: 30, w: 45, h: 4, field: 'staff_name', fontSize: 11 },
    ],
  },
  {
    name: 'Thông tin khách hàng',
    icon: User,
    elements: [
      { type: 'dynamic', x: 5, y: 36, w: 60, h: 4, field: 'customer_name', fontSize: 12, fontWeight: 'bold' },
      { type: 'dynamic', x: 5, y: 40, w: 45, h: 4, field: 'customer_phone', fontSize: 11 },
      { type: 'dynamic', x: 5, y: 44, w: 90, h: 4, field: 'billing_address', fontSize: 11 },
    ],
  },
  {
    name: 'Bảng sản phẩm',
    icon: Table,
    elements: [
      {
        type: 'table', x: 5, y: 50, w: 190, h: 25,
        tableColumns: [
          { label: 'STT', field: 'line_stt', width: 8 },
          { label: 'Tên SP', field: 'line_variant', width: 40 },
          { label: 'SL', field: 'line_qty', width: 10 },
          { label: 'Đơn giá', field: 'line_price', width: 20 },
          { label: 'Thành tiền', field: 'line_amount', width: 22 },
        ],
      },
    ],
  },
  {
    name: 'Tổng tiền',
    icon: DollarSign,
    elements: [
      { type: 'dynamic', x: 100, y: 78, w: 90, h: 5, field: 'total', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
    ],
  },
  {
    name: 'Chữ ký',
    icon: FileText,
    elements: [
      { type: 'text', x: 5, y: 88, w: 45, h: 4, content: 'Người mua hàng', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
      { type: 'text', x: 100, y: 88, w: 45, h: 4, content: 'Người bán hàng', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
      { type: 'text', x: 5, y: 92, w: 45, h: 3, content: '(Ký, ghi rõ họ tên)', fontSize: 9, textAlign: 'center' },
      { type: 'text', x: 100, y: 92, w: 45, h: 3, content: '(Ký, ghi rõ họ tên)', fontSize: 9, textAlign: 'center' },
    ],
  },
];

let _idCounter = 0;
const genId = () => `el_${Date.now()}_${++_idCounter}`;

export default function CustomPrintDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: templates } = useCustomPrintTemplates();
  const updateMutation = useUpdateCustomPrintTemplate();

  const template = templates?.find((t) => t.id === id);

  const [elements, setElements] = useState<TemplateElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load template data
  useEffect(() => {
    if (template && !loaded) {
      const saved = template.template_data as any;
      if (saved?.elements) {
        setElements(saved.elements);
      }
      setLoaded(true);
    }
  }, [template, loaded]);

  const paperSize = template ? PAPER_SIZES[template.paper_size] : PAPER_SIZES.A4;
  const selectedElement = elements.find((e) => e.id === selectedId);

  // ========== Canvas interaction ==========
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; elW: number; elH: number } | null>(null);

  const getGridPos = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { gx: 0, gy: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const gx = Math.round(((clientX - rect.left) / rect.width) * GRID_COLS);
    const gy = Math.round(((clientY - rect.top) / rect.height) * GRID_ROWS);
    return { gx: Math.max(0, Math.min(GRID_COLS, gx)), gy: Math.max(0, Math.min(GRID_ROWS, gy)) };
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedId(null);
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, el: TemplateElement) => {
    e.stopPropagation();
    setSelectedId(el.id);
    setDragging({ id: el.id, startX: e.clientX, startY: e.clientY, elX: el.x, elY: el.y });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, el: TemplateElement) => {
    e.stopPropagation();
    setResizing({ id: el.id, startX: e.clientX, startY: e.clientY, elW: el.w, elH: el.h });
  };

  useEffect(() => {
    if (!dragging && !resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragging && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const dx = ((e.clientX - dragging.startX) / rect.width) * GRID_COLS;
        const dy = ((e.clientY - dragging.startY) / rect.height) * GRID_ROWS;
        const newX = Math.max(0, Math.min(GRID_COLS - 10, Math.round(dragging.elX + dx)));
        const newY = Math.max(0, Math.min(GRID_ROWS - 3, Math.round(dragging.elY + dy)));
        setElements((prev) => prev.map((el) => el.id === dragging.id ? { ...el, x: newX, y: newY } : el));
      }
      if (resizing && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const dw = ((e.clientX - resizing.startX) / rect.width) * GRID_COLS;
        const dh = ((e.clientY - resizing.startY) / rect.height) * GRID_ROWS;
        const newW = Math.max(5, Math.round(resizing.elW + dw));
        const newH = Math.max(3, Math.round(resizing.elH + dh));
        setElements((prev) => prev.map((el) => el.id === resizing.id ? { ...el, w: newW, h: newH } : el));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, resizing]);

  // ========== Element CRUD ==========
  const addElement = (partial: Omit<TemplateElement, 'id'>) => {
    const el: TemplateElement = { id: genId(), ...partial };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  };

  const updateElement = (id: string, updates: Partial<TemplateElement>) => {
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const addPreset = (preset: typeof PRESET_BLOCKS[0]) => {
    const newEls = preset.elements.map((e) => ({ ...e, id: genId() } as TemplateElement));
    setElements((prev) => [...prev, ...newEls]);
  };

  // ========== Save ==========
  const handleSave = () => {
    if (!template) return;
    updateMutation.mutate({
      id: template.id,
      template_data: { elements } as any,
    });
  };

  if (!template) {
    return (
      <MainLayout>
        <div className="p-6 text-center text-muted-foreground">
          {templates === undefined ? 'Đang tải...' : 'Không tìm thấy mẫu in.'}
        </div>
      </MainLayout>
    );
  }

  // ========== Dynamic field label ==========
  const getFieldLabel = (key: string) => {
    for (const g of DYNAMIC_FIELDS) {
      const f = g.fields.find((f) => f.key === key);
      if (f) return f.label;
    }
    return key;
  };

  return (
    <MainLayout>
      <div className="p-2 sm:p-4">
        {/* Top bar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/export/template')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <div className="flex-1 min-w-0">
            <span className="font-semibold truncate">{template.name}</span>
            <Badge variant="outline" className="ml-2 text-xs">{template.paper_size}</Badge>
          </div>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>

        <div className="flex gap-3 flex-col lg:flex-row">
          {/* Left sidebar - Components */}
          <div className="w-full lg:w-56 shrink-0 space-y-3">
            {/* Add components */}
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Thêm thành phần</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => addElement({ type: 'text', x: 10, y: 10, w: 40, h: 5, content: 'Nội dung', fontSize: 12, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', textTransform: 'none' })}>
                    <Type className="h-3 w-3 mr-1" /> Chữ
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => addElement({ type: 'image', x: 10, y: 10, w: 30, h: 15 })}>
                    <ImageIcon className="h-3 w-3 mr-1" /> Ảnh
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => addElement({ type: 'line', x: 5, y: 50, w: 190, h: 1 })}>
                    <GripVertical className="h-3 w-3 mr-1 rotate-90" /> Đường kẻ
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => addElement({
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
              </CardContent>
            </Card>

            {/* Dynamic fields */}
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Biến dữ liệu</p>
                {DYNAMIC_FIELDS.map((group) => (
                  <div key={group.group}>
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <group.icon className="h-3 w-3" /> {group.group}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.fields.map((f) => (
                        <Badge
                          key={f.key}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => addElement({ type: 'dynamic', x: 10, y: 10, w: 40, h: 4, field: f.key, fontSize: 11, textAlign: 'left' })}
                        >
                          {f.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Preset blocks */}
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Mẫu dựng sẵn</p>
                <div className="space-y-1">
                  {PRESET_BLOCKS.map((preset) => (
                    <Button key={preset.name} variant="outline" size="sm" className="w-full text-xs justify-start" onClick={() => addPreset(preset)}>
                      <preset.icon className="h-3 w-3 mr-1.5" /> {preset.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Canvas */}
          <div className="flex-1 min-w-0">
            <div
              className="bg-white border shadow-sm mx-auto relative overflow-hidden"
              style={{
                aspectRatio: `${paperSize.width} / ${paperSize.height}`,
                maxWidth: '600px',
              }}
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
            >
              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: `
                  linear-gradient(to right, hsl(var(--border) / 0.15) 1px, transparent 1px),
                  linear-gradient(to bottom, hsl(var(--border) / 0.15) 1px, transparent 1px)
                `,
                backgroundSize: `${100 / 20}% ${100 / 20}%`,
              }} />

              {/* Elements */}
              {elements.map((el) => {
                const isSelected = el.id === selectedId;
                const left = `${(el.x / GRID_COLS) * 100}%`;
                const top = `${(el.y / GRID_ROWS) * 100}%`;
                const width = `${(el.w / GRID_COLS) * 100}%`;
                const height = `${(el.h / GRID_ROWS) * 100}%`;

                return (
                  <div
                    key={el.id}
                    className={`absolute cursor-move group ${isSelected ? 'ring-2 ring-primary z-10' : 'hover:ring-1 hover:ring-primary/50'}`}
                    style={{ left, top, width, height }}
                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                  >
                    {/* Content rendering */}
                    <div className="w-full h-full overflow-hidden flex items-start" style={{
                      fontSize: `${(el.fontSize || 12) * 0.6}px`,
                      fontWeight: el.fontWeight || 'normal',
                      fontStyle: el.fontStyle || 'normal',
                      textDecoration: el.textDecoration || 'none',
                      textAlign: (el.textAlign as any) || 'left',
                      textTransform: (el.textTransform as any) || 'none',
                      color: '#000',
                    }}>
                      {el.type === 'text' && <span className="w-full">{el.content || 'Text'}</span>}
                      {el.type === 'dynamic' && (
                        <span className="w-full text-blue-600 border border-dashed border-blue-300 bg-blue-50/50 px-0.5 rounded-sm">
                          {`{${el.field}}`} <span className="text-blue-400 text-[8px]">{getFieldLabel(el.field || '')}</span>
                        </span>
                      )}
                      {el.type === 'image' && (
                        <div className="w-full h-full border border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center">
                          {el.imageUrl ? (
                            <img src={el.imageUrl} className="max-w-full max-h-full object-contain" alt="" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                          )}
                        </div>
                      )}
                      {el.type === 'line' && (
                        <div className="w-full border-t border-black mt-[50%]" />
                      )}
                      {el.type === 'table' && (
                        <div className="w-full text-[7px] border border-black/30">
                          <div className="flex bg-muted/50 border-b border-black/30">
                            {(el.tableColumns || []).map((col, i) => (
                              <div key={i} className="px-0.5 py-px border-r border-black/20 font-bold truncate" style={{ width: `${col.width}%` }}>
                                {col.label}
                              </div>
                            ))}
                          </div>
                          {[1, 2].map((row) => (
                            <div key={row} className="flex border-b border-black/10">
                              {(el.tableColumns || []).map((col, i) => (
                                <div key={i} className="px-0.5 py-px border-r border-black/10 truncate text-muted-foreground" style={{ width: `${col.width}%` }}>
                                  {`{${col.field}}`}
                                </div>
                              ))}
                            </div>
                          ))}
                          <div className="text-center py-px text-muted-foreground italic">... auto lặp ...</div>
                        </div>
                      )}
                    </div>

                    {/* Resize handle */}
                    {isSelected && (
                      <div
                        className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-se-resize rounded-tl-sm"
                        onMouseDown={(e) => handleResizeMouseDown(e, el)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right sidebar - Properties */}
          <div className="w-full lg:w-56 shrink-0">
            {selectedElement ? (
              <Card>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      {selectedElement.type === 'text' ? 'Chữ' : selectedElement.type === 'dynamic' ? 'Biến' : selectedElement.type === 'image' ? 'Ảnh' : selectedElement.type === 'table' ? 'Bảng SP' : 'Đường kẻ'}
                    </p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteElement(selectedElement.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Position */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">X</Label>
                      <Input type="number" className="h-7 text-xs" value={selectedElement.x} onChange={(e) => updateElement(selectedElement.id, { x: +e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Y</Label>
                      <Input type="number" className="h-7 text-xs" value={selectedElement.y} onChange={(e) => updateElement(selectedElement.id, { y: +e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">W</Label>
                      <Input type="number" className="h-7 text-xs" value={selectedElement.w} onChange={(e) => updateElement(selectedElement.id, { w: +e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">H</Label>
                      <Input type="number" className="h-7 text-xs" value={selectedElement.h} onChange={(e) => updateElement(selectedElement.id, { h: +e.target.value })} />
                    </div>
                  </div>

                  {/* Text properties */}
                  {(selectedElement.type === 'text' || selectedElement.type === 'dynamic') && (
                    <>
                      <Separator />
                      {selectedElement.type === 'text' && (
                        <div>
                          <Label className="text-[10px]">Nội dung</Label>
                          <Input className="h-7 text-xs" value={selectedElement.content || ''} onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} />
                        </div>
                      )}
                      {selectedElement.type === 'dynamic' && (
                        <div>
                          <Label className="text-[10px]">Biến</Label>
                          <Select value={selectedElement.field || ''} onValueChange={(v) => updateElement(selectedElement.id, { field: v })}>
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
                        <Input type="number" className="h-7 text-xs" value={selectedElement.fontSize || 12} onChange={(e) => updateElement(selectedElement.id, { fontSize: +e.target.value })} />
                      </div>
                      <div className="flex gap-1">
                        <Button variant={selectedElement.fontWeight === 'bold' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => updateElement(selectedElement.id, { fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' })}>
                          <Bold className="h-3 w-3" />
                        </Button>
                        <Button variant={selectedElement.fontStyle === 'italic' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => updateElement(selectedElement.id, { fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' })}>
                          <Italic className="h-3 w-3" />
                        </Button>
                        <Button variant={selectedElement.textDecoration === 'underline' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => updateElement(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'underline' ? 'none' : 'underline' })}>
                          <Underline className="h-3 w-3" />
                        </Button>
                        <div className="w-px bg-border mx-0.5" />
                        <Button variant={selectedElement.textAlign === 'left' || !selectedElement.textAlign ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => updateElement(selectedElement.id, { textAlign: 'left' })}>
                          <AlignLeft className="h-3 w-3" />
                        </Button>
                        <Button variant={selectedElement.textAlign === 'center' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => updateElement(selectedElement.id, { textAlign: 'center' })}>
                          <AlignCenter className="h-3 w-3" />
                        </Button>
                        <Button variant={selectedElement.textAlign === 'right' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => updateElement(selectedElement.id, { textAlign: 'right' })}>
                          <AlignRight className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="uppercase" checked={selectedElement.textTransform === 'uppercase'} onChange={(e) => updateElement(selectedElement.id, { textTransform: e.target.checked ? 'uppercase' : 'none' })} />
                        <Label htmlFor="uppercase" className="text-[10px]">IN HOA</Label>
                      </div>
                    </>
                  )}

                  {/* Image upload */}
                  {selectedElement.type === 'image' && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-[10px]">URL ảnh</Label>
                        <Input className="h-7 text-xs" value={selectedElement.imageUrl || ''} onChange={(e) => updateElement(selectedElement.id, { imageUrl: e.target.value })} placeholder="https://..." />
                      </div>
                    </>
                  )}

                  {/* Table config */}
                  {selectedElement.type === 'table' && (
                    <>
                      <Separator />
                      <p className="text-[10px] font-semibold text-muted-foreground">Cột bảng</p>
                      {(selectedElement.tableColumns || []).map((col, i) => (
                        <div key={i} className="flex gap-1 items-end">
                          <div className="flex-1">
                            <Label className="text-[10px]">Tên</Label>
                            <Input className="h-7 text-xs" value={col.label} onChange={(e) => {
                              const cols = [...(selectedElement.tableColumns || [])];
                              cols[i] = { ...cols[i], label: e.target.value };
                              updateElement(selectedElement.id, { tableColumns: cols });
                            }} />
                          </div>
                          <div className="w-20">
                            <Label className="text-[10px]">Field</Label>
                            <Select value={col.field} onValueChange={(v) => {
                              const cols = [...(selectedElement.tableColumns || [])];
                              cols[i] = { ...cols[i], field: v };
                              updateElement(selectedElement.id, { tableColumns: cols });
                            }}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {TABLE_FIELD_OPTIONS.map((f) => (
                                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-12">
                            <Label className="text-[10px]">%</Label>
                            <Input type="number" className="h-7 text-xs" value={col.width} onChange={(e) => {
                              const cols = [...(selectedElement.tableColumns || [])];
                              cols[i] = { ...cols[i], width: +e.target.value };
                              updateElement(selectedElement.id, { tableColumns: cols });
                            }} />
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                            const cols = (selectedElement.tableColumns || []).filter((_, j) => j !== i);
                            updateElement(selectedElement.id, { tableColumns: cols });
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
                        const cols = [...(selectedElement.tableColumns || []), { label: 'Mới', field: 'line_stt', width: 10 }];
                        updateElement(selectedElement.id, { tableColumns: cols });
                      }}>
                        <Plus className="h-3 w-3 mr-1" /> Thêm cột
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-3 text-center text-xs text-muted-foreground py-8">
                  Click vào thành phần trên giấy để chỉnh sửa
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
