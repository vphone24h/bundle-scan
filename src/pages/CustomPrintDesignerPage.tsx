import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Printer } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useCustomPrintTemplates,
  useUpdateCustomPrintTemplate,
} from '@/hooks/useCustomPrintTemplates';
import { DesignerSidebar } from '@/components/print-templates/designer/DesignerSidebar';
import { DesignerCanvas } from '@/components/print-templates/designer/DesignerCanvas';
import { PropertyPanel } from '@/components/print-templates/designer/PropertyPanel';
import { PAPER_SIZES, genId, type TemplateElement } from '@/components/print-templates/designer/types';
import { renderCustomPrintHTML } from '@/components/print-templates/customPrintRenderer';

export type { TemplateElement } from '@/components/print-templates/designer/types';

export default function CustomPrintDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: templates } = useCustomPrintTemplates();
  const updateMutation = useUpdateCustomPrintTemplate();

  const template = templates?.find((t) => t.id === id);

  const [elements, setElements] = useState<TemplateElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (template && !loaded) {
      const saved = template.template_data as any;
      if (saved?.elements) setElements(saved.elements);
      setLoaded(true);
    }
  }, [template, loaded]);

  const paperSize = template ? PAPER_SIZES[template.paper_size] : PAPER_SIZES.A4;
  const selectedElement = elements.find((e) => e.id === selectedId);

  const addElement = useCallback((partial: Omit<TemplateElement, 'id'>) => {
    const el: TemplateElement = { id: genId(), ...partial };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }, []);

  const addPreset = useCallback((presetElements: Omit<TemplateElement, 'id'>[]) => {
    const newEls = presetElements.map((e) => ({ ...e, id: genId() } as TemplateElement));
    setElements((prev) => [...prev, ...newEls]);
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<TemplateElement>) => {
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, ...updates } : el));
  }, []);

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedId((prev) => prev === id ? null : prev);
  }, []);

  const duplicateElement = useCallback((id: string) => {
    setElements((prev) => {
      const el = prev.find((e) => e.id === id);
      if (!el) return prev;
      const newEl = { ...el, id: genId(), x: el.x + 3, y: el.y + 3 };
      setSelectedId(newEl.id);
      return [...prev, newEl];
    });
  }, []);

  const moveUp = useCallback((id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx < prev.length - 1) {
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      }
      return prev;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx > 0) {
        const next = [...prev];
        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
        return next;
      }
      return prev;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        deleteElement(selectedId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateElement(selectedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, deleteElement, duplicateElement]);

  const handleSave = () => {
    if (!template) return;
    updateMutation.mutate({ id: template.id, template_data: { elements } as any });
  };

  const handleTestPrint = () => {
    if (!template) return;
    const sampleReceipt = {
      invoice_code: 'HD-TEST-001',
      date: new Date().toLocaleDateString('vi-VN'),
      customer_name: 'Nguyễn Văn A',
      customer_phone: '0901234567',
      customer_address: '123 Đường ABC, Quận 1, TP.HCM',
      items: [
        { name: 'iPhone 15 Pro Max 256GB', sku: 'IP15PM-256', imei: '123456789012345', quantity: 1, price: 32990000, warranty: '12 tháng' },
        { name: 'Ốp lưng iPhone 15 Pro Max', sku: 'OL-IP15PM', imei: '', quantity: 2, price: 250000, warranty: '' },
      ],
      subtotal: 33490000,
      discount: 500000,
      total: 32990000,
      amount_paid: 32990000,
      amount_due: 0,
      payment_method: 'Tiền mặt',
      note: 'Ghi chú test mẫu in',
      seller_name: 'Nhân viên Test',
    };

    const currentTemplate = {
      ...template,
      template_data: { elements } as any,
    };

    const html = renderCustomPrintHTML(currentTemplate as any, sampleReceipt, {
      store_name: 'Cửa hàng VKHO Demo',
      store_phone: '0909999888',
      store_address: '456 Đường XYZ, Quận 3, TP.HCM',
    });

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 3000);
      }, 300);
    }
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

  return (
    <MainLayout>
      <div className="p-2 sm:p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/export/template')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <div className="flex-1 min-w-0">
            <span className="font-semibold truncate">{template.name}</span>
            <Badge variant="outline" className="ml-2 text-xs">{template.paper_size}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={handleTestPrint}>
            <Printer className="h-4 w-4 mr-1" /> In thử
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>

        <div className="flex gap-3 flex-col lg:flex-row">
          <DesignerSidebar onAddElement={addElement} onAddPreset={addPreset} />
          <DesignerCanvas
            elements={elements}
            selectedId={selectedId}
            paperSize={paperSize}
            onSelect={setSelectedId}
            onUpdate={updateElement}
          />
          <div className="w-full lg:w-56 shrink-0">
            <PropertyPanel
              element={selectedElement}
              onUpdate={updateElement}
              onDelete={deleteElement}
              onDuplicate={duplicateElement}
              onMoveUp={moveUp}
              onMoveDown={moveDown}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
