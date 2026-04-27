import React, { useRef, useCallback, useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
  Image,
  Palette,
  List,
  ListOrdered,
  Heading2,
  Undo,
  Redo,
  Type,
  Upload,
  Loader2,
  Table as TableIcon,
  Plus,
  Minus,
  PaintBucket,
  ChevronDown,
  Rows,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const COLORS = [
  '#000000', '#374151', '#6b7280', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#0f766e', '#1e3a5f',
];

// Cỡ chữ tính bằng px (dùng inline style để có nhiều mức)
const FONT_SIZES_PX = [
  10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72,
];

const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: 'Mặc định', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Open Sans', value: '"Open Sans", sans-serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
];

const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
]);

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded hover:bg-muted transition-colors',
        active && 'bg-muted text-primary'
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '200px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resizingImg, setResizingImg] = useState<HTMLImageElement | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableHover, setTableHover] = useState<{ rows: number; cols: number }>({ rows: 0, cols: 0 });
  const [activeTable, setActiveTable] = useState<HTMLTableElement | null>(null);
  const [tableHandles, setTableHandles] = useState<{
    cols: { left: number; top: number; height: number; index: number }[];
    rows: { left: number; top: number; width: number; index: number }[];
    corner: { left: number; top: number } | null;
  } | null>(null);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Only save if selection is inside the editor
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current && editorRef.current) {
      // Verify the saved range is still valid within the editor
      if (editorRef.current.contains(savedSelectionRef.current.commonAncestorContainer)) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
        return true;
      }
    }
    return false;
  }, []);

  const insertAtCursorOrEnd = useCallback((html: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const restored = restoreSelection();

    if (!restored) {
      // Place cursor at end of editor
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    document.execCommand('insertHTML', false, DOMPurify.sanitize(html, {
      ADD_TAGS: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
      ADD_ATTR: ['colspan', 'rowspan', 'align', 'valign', 'style', 'width', 'height', 'bgcolor', 'cellspacing', 'cellpadding', 'border'],
    }));
    onChange(editor.innerHTML);
    // Save the new cursor position
    saveSelection();
  }, [onChange, restoreSelection, saveSelection]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Áp dụng style (font-size px / font-family) lên vùng đang chọn bằng cách
  // bọc vào <span style="..."> — hoạt động linh hoạt hơn execCommand('fontSize').
  const applyInlineStyle = useCallback((styleProp: 'fontSize' | 'fontFamily', cssValue: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    if (range.collapsed) {
      // Không có vùng chọn: chèn span rỗng để gõ tiếp với style mới
      const span = document.createElement('span');
      (span.style as any)[styleProp] = cssValue;
      span.appendChild(document.createTextNode('\u200B'));
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(span.firstChild!, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      const span = document.createElement('span');
      (span.style as any)[styleProp] = cssValue;
      try {
        span.appendChild(range.extractContents());
        range.insertNode(span);
        // Chọn lại nội dung vừa style
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } catch {
        // fallback
      }
    }
    saveSelection();
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange, restoreSelection, saveSelection]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
        ADD_ATTR: ['colspan', 'rowspan', 'align', 'valign', 'style', 'width', 'height', 'bgcolor', 'cellspacing', 'cellpadding', 'border'],
      });
      document.execCommand('insertHTML', false, sanitizedHtml);
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }
  }, [onChange]);

  const insertLink = useCallback(() => {
    if (linkUrl) {
      const sanitizedUrl = linkUrl.trim();
      try {
        const url = new URL(sanitizedUrl);
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return;
      } catch { return; }
      restoreSelection();
      execCommand('createLink', sanitizedUrl);
      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        const link = (selection.anchorNode as HTMLElement).closest?.('a') ||
          (selection.anchorNode.parentElement as HTMLElement)?.closest?.('a');
        if (link) {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        }
      }
      setLinkUrl('');
      setLinkOpen(false);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    }
  }, [linkUrl, execCommand, onChange, restoreSelection]);

  const insertImageHtml = useCallback((url: string) => {
    const html = `<img src="${url}" alt="image" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;cursor:pointer;" />`;
    insertAtCursorOrEnd(html);
  }, [insertAtCursorOrEnd]);

  const insertImage = useCallback(() => {
    if (imageUrl) {
      const sanitizedUrl = imageUrl.trim();
      try {
        const url = new URL(sanitizedUrl);
        if (!['http:', 'https:'].includes(url.protocol)) return;
      } catch { return; }
      insertImageHtml(sanitizedUrl);
      setImageUrl('');
      setImageOpen(false);
    }
  }, [imageUrl, insertImageHtml]);

  // === TABLE INSERT & EDIT ===
  const insertTable = useCallback((rows: number, cols: number) => {
    if (rows < 1 || cols < 1) return;
    const colWidth = Math.floor(100 / cols);
    let html = '<table class="rte-table" style="border-collapse:collapse;width:100%;margin:8px 0;table-layout:fixed;word-wrap:break-word;"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? 'th' : 'td';
        const style = `border:1px solid #d1d5db;padding:6px 8px;${r === 0 ? 'background:#f3f4f6;font-weight:700;text-align:center;' : ''}width:${colWidth}%;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word;word-break:break-word;white-space:normal;`;
        html += `<${tag} style="${style}">${r === 0 ? `Cột ${c + 1}` : '&nbsp;'}</${tag}>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br/></p>';
    insertAtCursorOrEnd(html);
    setTableOpen(false);
    setTableHover({ rows: 0, cols: 0 });
  }, [insertAtCursorOrEnd]);

  const getCurrentCell = useCallback((): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLElement && (node.tagName === 'TD' || node.tagName === 'TH')) {
        return node as HTMLTableCellElement;
      }
      node = node.parentNode;
    }
    return null;
  }, []);

  // === MULTI-CELL SELECTION (quét nhiều ô như Word) ===
  const selectedCellsRef = useRef<HTMLTableCellElement[]>([]);
  const dragStartCellRef = useRef<HTMLTableCellElement | null>(null);

  const clearCellSelection = useCallback(() => {
    selectedCellsRef.current.forEach((c) => c.removeAttribute('data-rte-selected'));
    selectedCellsRef.current = [];
  }, []);

  const getCellsInRange = useCallback((a: HTMLTableCellElement, b: HTMLTableCellElement): HTMLTableCellElement[] => {
    const tableA = a.closest('table');
    const tableB = b.closest('table');
    if (!tableA || tableA !== tableB) return [a];
    const rows = Array.from(tableA.querySelectorAll('tr')) as HTMLTableRowElement[];
    const ra = rows.findIndex((r) => Array.from(r.cells).includes(a));
    const rb = rows.findIndex((r) => Array.from(r.cells).includes(b));
    const ca = Array.from((a.parentElement as HTMLTableRowElement).cells).indexOf(a);
    const cb = Array.from((b.parentElement as HTMLTableRowElement).cells).indexOf(b);
    const [r1, r2] = [Math.min(ra, rb), Math.max(ra, rb)];
    const [c1, c2] = [Math.min(ca, cb), Math.max(ca, cb)];
    const result: HTMLTableCellElement[] = [];
    for (let i = r1; i <= r2; i++) {
      for (let j = c1; j <= c2; j++) {
        const cell = rows[i]?.cells[j];
        if (cell) result.push(cell as HTMLTableCellElement);
      }
    }
    return result;
  }, []);

  const applyCellSelection = useCallback((cells: HTMLTableCellElement[]) => {
    clearCellSelection();
    cells.forEach((c) => c.setAttribute('data-rte-selected', 'true'));
    selectedCellsRef.current = cells;
  }, [clearCellSelection]);

  const handleEditorMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const cell = target.closest?.('td, th') as HTMLTableCellElement | null;
    if (!cell || !editorRef.current?.contains(cell)) {
      clearCellSelection();
      dragStartCellRef.current = null;
      return;
    }
    dragStartCellRef.current = cell;
    clearCellSelection();
    const onMove = (ev: MouseEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const overCell = el?.closest?.('td, th') as HTMLTableCellElement | null;
      if (!overCell || !dragStartCellRef.current) return;
      if (overCell === dragStartCellRef.current) {
        clearCellSelection();
        return;
      }
      const cells = getCellsInRange(dragStartCellRef.current, overCell);
      if (cells.length > 1) {
        ev.preventDefault();
        applyCellSelection(cells);
        // Clear text selection để tránh nháy
        window.getSelection()?.removeAllRanges();
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [applyCellSelection, clearCellSelection, getCellsInRange]);

  // Tô màu nền cho các ô đang chọn (hoặc ô hiện tại nếu chưa quét)
  const setCellsBackground = useCallback((color: string | null) => {
    let cells = selectedCellsRef.current;
    if (!cells.length) {
      const c = getCurrentCell();
      if (c) cells = [c];
    }
    if (!cells.length) {
      toast({ title: 'Hãy đặt con trỏ vào ô hoặc quét chọn các ô trong bảng', variant: 'destructive' });
      return;
    }
    cells.forEach((cell) => {
      if (color) {
        cell.style.backgroundColor = color;
        cell.setAttribute('bgcolor', color);
      } else {
        cell.style.backgroundColor = '';
        cell.removeAttribute('bgcolor');
      }
    });
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [getCurrentCell, onChange]);


  const tableAction = useCallback((action: 'addRow' | 'delRow' | 'addCol' | 'delCol' | 'delTable') => {
    const cell = getCurrentCell();
    if (!cell) {
      toast({ title: 'Hãy đặt con trỏ vào ô trong bảng trước', variant: 'destructive' });
      return;
    }
    const row = cell.parentElement as HTMLTableRowElement;
    const table = cell.closest('table') as HTMLTableElement;
    const tbody = table.querySelector('tbody') || table;
    const cellIdx = Array.from(row.cells).indexOf(cell);

    if (action === 'addRow') {
      const newRow = document.createElement('tr');
      for (let i = 0; i < row.cells.length; i++) {
        const td = document.createElement('td');
        td.style.cssText = 'border:1px solid #d1d5db;padding:6px 8px;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word;word-break:break-word;white-space:normal;';
        td.innerHTML = '&nbsp;';
        newRow.appendChild(td);
      }
      row.after(newRow);
    } else if (action === 'delRow') {
      if (tbody.querySelectorAll('tr').length > 1) row.remove();
    } else if (action === 'addCol') {
      Array.from(tbody.querySelectorAll('tr')).forEach((tr, idx) => {
        const isHead = (tr as HTMLTableRowElement).cells[0]?.tagName === 'TH';
        const cellEl = document.createElement(isHead && idx === 0 ? 'th' : 'td');
        cellEl.style.cssText = `border:1px solid #d1d5db;padding:6px 8px;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word;word-break:break-word;white-space:normal;${isHead && idx === 0 ? 'background:#f3f4f6;font-weight:700;text-align:center;' : ''}`;
        cellEl.innerHTML = isHead && idx === 0 ? 'Cột mới' : '&nbsp;';
        const targetCell = (tr as HTMLTableRowElement).cells[cellIdx];
        if (targetCell) targetCell.after(cellEl);
        else (tr as HTMLTableRowElement).appendChild(cellEl);
      });
    } else if (action === 'delCol') {
      const rows = tbody.querySelectorAll('tr');
      if (rows[0] && (rows[0] as HTMLTableRowElement).cells.length > 1) {
        rows.forEach(tr => {
          const c = (tr as HTMLTableRowElement).cells[cellIdx];
          if (c) c.remove();
        });
      }
    } else if (action === 'delTable') {
      table.remove();
    }
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [getCurrentCell, onChange]);


  const applyListStyle = useCallback((ordered: boolean, listStyleType: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();
    // Đảm bảo vùng chọn nằm trong list đúng loại
    document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList');
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== editor) {
        if (node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')) {
          (node as HTMLElement).style.listStyleType = listStyleType;
          break;
        }
        node = node.parentNode;
      }
    }
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    saveSelection();
  }, [onChange, restoreSelection, saveSelection]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Save selection BEFORE async operation
    saveSelection();
    setUploading(true);
    const uploadedUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_UPLOAD_SIZE) {
          toast({
            title: 'Ảnh quá lớn',
            description: `${file.name}: tối đa 15MB.`,
            variant: 'destructive',
          });
          continue;
        }
        if (file.type && !ALLOWED_UPLOAD_MIME_TYPES.has(file.type.toLowerCase())) {
          toast({
            title: 'Định dạng ảnh chưa hỗ trợ',
            description: `${file.name}: chọn JPG, PNG, GIF, WEBP, HEIC hoặc AVIF.`,
            variant: 'destructive',
          });
          continue;
        }
        try {
          const ext = file.name.split('.').pop() || 'jpg';
          const path = `editor/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await supabase.storage
            .from('tenant-assets')
            .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
          if (error) throw error;
          const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
          if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);
        } catch (err: any) {
          console.error('Upload failed:', err);
          toast({
            title: 'Upload ảnh thất bại',
            description: `${file.name}: ${err?.message || 'thử lại.'}`,
            variant: 'destructive',
          });
        }
      }

      if (uploadedUrls.length === 1) {
        insertImageHtml(uploadedUrls[0]);
      } else if (uploadedUrls.length > 1) {
        // Nhiều ảnh -> chèn trên cùng 1 hàng (flex row, có thể wrap)
        const imgs = uploadedUrls
          .map(u => `<img src="${u}" alt="image" style="flex:1 1 0;min-width:0;max-width:100%;height:auto;border-radius:8px;object-fit:cover;cursor:pointer;" />`)
          .join('');
        const html = `<div class="rte-image-row" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:flex-start;">${imgs}</div><p><br/></p>`;
        insertAtCursorOrEnd(html);
      }
      if (uploadedUrls.length > 0) setImageOpen(false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [insertImageHtml, insertAtCursorOrEnd, saveSelection]);

  // Image resize: click to select, drag corner to resize. Also detect active table for col/row resize.
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      setResizingImg(target as HTMLImageElement);
      setActiveTable(null);
    } else {
      setResizingImg(null);
      const tbl = target.closest?.('table') as HTMLTableElement | null;
      setActiveTable(tbl && editorRef.current?.contains(tbl) ? tbl : null);
    }
  }, []);

  // Helper: is this block element "image-only" (contains only <img> + whitespace/<br>)
  const isImageOnlyBlock = useCallback((el: HTMLElement | null): boolean => {
    if (!el) return false;
    const imgs = el.querySelectorAll('img');
    if (imgs.length === 0) return false;
    const text = (el.textContent || '').replace(/\u200B/g, '').trim();
    return text.length === 0;
  }, []);

  // Helper: is element an empty block (only <br> or whitespace, no images)
  const isEmptyBlock = useCallback((el: Element | null): boolean => {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (!/^(P|DIV)$/.test(el.tagName)) return false;
    if (el.querySelector('img')) return false;
    const text = (el.textContent || '').replace(/\u200B/g, '').trim();
    return text.length === 0;
  }, []);

  // Helper: check if cursor is at the very start of a block
  const isCursorAtBlockStart = useCallback((range: Range, block: HTMLElement): boolean => {
    if (range.startOffset !== 0) {
      // Could be a text node; if the text node is first descendant and offset=0 we still allow
      return false;
    }
    // Walk up: ensure no previous sibling/content before cursor inside block
    let node: Node | null = range.startContainer;
    while (node && node !== block) {
      if (node.previousSibling) return false;
      node = node.parentNode;
    }
    return node === block;
  }, []);

  // Find nearest block ancestor (P/DIV/FIGURE) inside editor
  const findBlock = useCallback((startNode: Node): HTMLElement | null => {
    let node: Node | null = startNode;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLElement && /^(P|DIV|FIGURE)$/.test(node.tagName)) {
        // Skip the editor itself
        if (node !== editorRef.current) return node;
      }
      node = node.parentNode;
    }
    return null;
  }, []);

  const styleRowImg = useCallback((img: HTMLImageElement) => {
    img.style.flex = '1 1 0';
    img.style.minWidth = '0';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    if (!img.style.borderRadius) img.style.borderRadius = '8px';
    if (!img.style.objectFit) img.style.objectFit = 'cover';
    img.style.cursor = 'pointer';
    img.style.margin = '0';
  }, []);

  // Merge `block` into `prev` (must both be image-only blocks). Returns the resulting row.
  const mergeImageBlocks = useCallback((prev: HTMLElement, block: HTMLElement): HTMLElement => {
    let row: HTMLElement;
    if (prev.classList.contains('rte-image-row')) {
      row = prev;
    } else {
      row = document.createElement('div');
      row.className = 'rte-image-row';
      row.setAttribute('style', 'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:flex-start;');
      Array.from(prev.querySelectorAll('img')).forEach((img) => {
        styleRowImg(img as HTMLImageElement);
        row.appendChild(img);
      });
      prev.replaceWith(row);
    }
    Array.from(block.querySelectorAll('img')).forEach((img) => {
      styleRowImg(img as HTMLImageElement);
      row.appendChild(img);
    });
    block.remove();
    return row;
  }, [styleRowImg]);

  // Quét toàn bộ editor: gộp các block image-only liên tiếp (kể cả khi giữa có block trống) thành 1 hàng.
  const mergeAllImageBlocks = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    let changed = false;
    let pass = 0;
    while (pass < 20) {
      pass++;
      let didMerge = false;
      // Xoá các block trống nằm giữa 2 block ảnh
      const children = Array.from(editor.children);
      for (let i = 1; i < children.length - 1; i++) {
        const cur = children[i];
        if (isEmptyBlock(cur)) {
          const prev = cur.previousElementSibling as HTMLElement | null;
          const next = cur.nextElementSibling as HTMLElement | null;
          if (prev && next && isImageOnlyBlock(prev) && isImageOnlyBlock(next)) {
            cur.remove();
            didMerge = true;
            changed = true;
            break;
          }
        }
      }
      if (didMerge) continue;
      // Gộp 2 block ảnh liên tiếp
      const kids = Array.from(editor.children);
      for (let i = 0; i < kids.length - 1; i++) {
        const a = kids[i] as HTMLElement;
        const b = kids[i + 1] as HTMLElement;
        if (isImageOnlyBlock(a) && isImageOnlyBlock(b)) {
          mergeImageBlocks(a, b);
          didMerge = true;
          changed = true;
          break;
        }
      }
      if (!didMerge) break;
    }
    if (changed) {
      onChange(editor.innerHTML);
      toast({ title: 'Đã gộp các ảnh thành 1 hàng' });
    } else {
      toast({ title: 'Không có ảnh liền nhau để gộp', variant: 'destructive' });
    }
  }, [isEmptyBlock, isImageOnlyBlock, mergeImageBlocks, onChange]);

  // Backspace at start of an image-only block -> merge into previous image-only block as a flex row
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Backspace') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const block = findBlock(range.startContainer);
    if (!block || !editorRef.current?.contains(block)) return;

    // Case A: cursor in image-only block, at the start -> merge with prev image block
    if (isImageOnlyBlock(block) && isCursorAtBlockStart(range, block)) {
      let prev = block.previousElementSibling as HTMLElement | null;
      // Skip empty blocks between
      while (prev && isEmptyBlock(prev)) {
        const toRemove = prev;
        prev = prev.previousElementSibling as HTMLElement | null;
        toRemove.remove();
      }
      if (prev && isImageOnlyBlock(prev)) {
        e.preventDefault();
        const row = mergeImageBlocks(prev, block);
        const newRange = document.createRange();
        newRange.setStartAfter(row);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        if (editorRef.current) onChange(editorRef.current.innerHTML);
        return;
      }
    }

    // Case B: cursor in an empty block sandwiched between two image-only blocks
    if (isEmptyBlock(block)) {
      const prev = block.previousElementSibling as HTMLElement | null;
      const next = block.nextElementSibling as HTMLElement | null;
      if (prev && next && isImageOnlyBlock(prev) && isImageOnlyBlock(next)) {
        e.preventDefault();
        block.remove();
        const row = mergeImageBlocks(prev, next);
        const newRange = document.createRange();
        newRange.setStartAfter(row);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        if (editorRef.current) onChange(editorRef.current.innerHTML);
        return;
      }
    }
  }, [findBlock, isImageOnlyBlock, isEmptyBlock, isCursorAtBlockStart, mergeImageBlocks, onChange]);

  // Compute column/row handle positions for the active table
  useEffect(() => {
    if (!activeTable || !editorRef.current) {
      setTableHandles(null);
      return;
    }
    const compute = () => {
      const editor = editorRef.current;
      if (!activeTable || !editor) return;
      const eRect = editor.getBoundingClientRect();
      const tRect = activeTable.getBoundingClientRect();
      const firstRow = activeTable.querySelector('tr');
      if (!firstRow) return;
      const cells = Array.from((firstRow as HTMLTableRowElement).cells);
      const cols = cells.slice(0, -1).map((cell, index) => {
        const cRect = cell.getBoundingClientRect();
        return {
          left: cRect.right - eRect.left + editor.scrollLeft,
          top: tRect.top - eRect.top + editor.scrollTop,
          height: tRect.height,
          index,
        };
      });
      const rowsEls = Array.from(activeTable.querySelectorAll('tr')) as HTMLTableRowElement[];
      const rows = rowsEls.slice(0, -1).map((tr, index) => {
        const rRect = tr.getBoundingClientRect();
        return {
          left: tRect.left - eRect.left + editor.scrollLeft,
          top: rRect.bottom - eRect.top + editor.scrollTop,
          width: tRect.width,
          index,
        };
      });
      const corner = {
        left: tRect.right - eRect.left + editor.scrollLeft,
        top: tRect.bottom - eRect.top + editor.scrollTop,
      };
      setTableHandles({ cols, rows, corner });
    };
    compute();
    const observer = new MutationObserver(compute);
    observer.observe(activeTable, { childList: true, subtree: true, attributes: true });
    const onScroll = () => compute();
    editorRef.current.addEventListener('scroll', onScroll);
    window.addEventListener('resize', compute);
    return () => {
      observer.disconnect();
      editorRef.current?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', compute);
    };
  }, [activeTable]);

  // Clear active table when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setActiveTable(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Resize a column: drag right edge of cell at column index
  const startColResize = useCallback((e: React.MouseEvent | React.TouchEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeTable) return;
    const firstRow = activeTable.querySelector('tr') as HTMLTableRowElement | null;
    if (!firstRow) return;
    const cell = firstRow.cells[colIndex] as HTMLTableCellElement | undefined;
    const nextCell = firstRow.cells[colIndex + 1] as HTMLTableCellElement | undefined;
    if (!cell) return;
    // Switch to fixed pixel layout for predictable resize
    activeTable.style.tableLayout = 'fixed';
    activeTable.style.width = `${activeTable.offsetWidth}px`;
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startW = cell.offsetWidth;
    const startNextW = nextCell?.offsetWidth || 0;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const dx = clientX - startX;
      const newW = Math.max(30, startW + dx);
      cell.style.width = `${newW}px`;
      if (nextCell) {
        const newNext = Math.max(30, startNextW - dx);
        nextCell.style.width = `${newNext}px`;
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove as any);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove as any);
      document.removeEventListener('touchend', onUp);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };
    document.addEventListener('mousemove', onMove as any);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove as any, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [activeTable, onChange]);

  // Resize a row: drag bottom edge of row
  const startRowResize = useCallback((e: React.MouseEvent | React.TouchEvent, rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeTable) return;
    const tr = activeTable.querySelectorAll('tr')[rowIndex] as HTMLTableRowElement | undefined;
    if (!tr) return;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startH = tr.offsetHeight;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dy = clientY - startY;
      const newH = Math.max(20, startH + dy);
      tr.style.height = `${newH}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove as any);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove as any);
      document.removeEventListener('touchend', onUp);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };
    document.addEventListener('mousemove', onMove as any);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove as any, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [activeTable, onChange]);
  // Resize toàn bộ bảng: kéo góc dưới-phải
  const startTableResize = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeTable) return;
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startW = activeTable.offsetWidth;
    const startH = activeTable.offsetHeight;
    activeTable.style.tableLayout = 'fixed';
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const newW = Math.max(80, startW + (cx - startX));
      const newH = Math.max(40, startH + (cy - startY));
      activeTable.style.width = `${newW}px`;
      activeTable.style.height = `${newH}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove as any);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove as any);
      document.removeEventListener('touchend', onUp);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };
    document.addEventListener('mousemove', onMove as any);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove as any, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [activeTable, onChange]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!resizingImg) return;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: resizingImg.offsetWidth,
      h: resizingImg.offsetHeight,
    };

    const onMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current || !resizingImg) return;
      const dx = ev.clientX - resizeStartRef.current.x;
      const newW = Math.max(50, resizeStartRef.current.w + dx);
      const ratio = resizeStartRef.current.h / resizeStartRef.current.w;
      resizingImg.style.width = `${newW}px`;
      resizingImg.style.height = `${Math.round(newW * ratio)}px`;
      resizingImg.style.maxWidth = '100%';
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      resizeStartRef.current = null;
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [resizingImg, onChange]);

  // Touch resize support
  const handleTouchResizeStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!resizingImg || !e.touches[0]) return;
    resizeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      w: resizingImg.offsetWidth,
      h: resizingImg.offsetHeight,
    };

    const onMove = (ev: TouchEvent) => {
      if (!resizeStartRef.current || !resizingImg || !ev.touches[0]) return;
      const dx = ev.touches[0].clientX - resizeStartRef.current.x;
      const newW = Math.max(50, resizeStartRef.current.w + dx);
      const ratio = resizeStartRef.current.h / resizeStartRef.current.w;
      resizingImg.style.width = `${newW}px`;
      resizingImg.style.height = `${Math.round(newW * ratio)}px`;
      resizingImg.style.maxWidth = '100%';
    };

    const onUp = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      resizeStartRef.current = null;
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [resizingImg, onChange]);

  // Clear resize selection when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setResizingImg(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Set initial content
  const handleRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      (editorRef as React.MutableRefObject<HTMLDivElement>).current = el;
      if (el.innerHTML !== value && value) {
        el.innerHTML = value;
      }
    }
  }, []); // Only run once on mount

  // Sync value when it changes externally
  useEffect(() => {
    if (editorRef.current && value && editorRef.current.innerHTML !== value) {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value]);

  // Compute resize overlay position
  const [resizeOverlay, setResizeOverlay] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!resizingImg || !editorRef.current) {
      setResizeOverlay(null);
      return;
    }
    const updateOverlay = () => {
      if (!resizingImg || !editorRef.current) return;
      const editorRect = editorRef.current.getBoundingClientRect();
      const imgRect = resizingImg.getBoundingClientRect();
      setResizeOverlay({
        top: imgRect.top - editorRect.top,
        left: imgRect.left - editorRect.left,
        width: imgRect.width,
        height: imgRect.height,
      });
    };
    updateOverlay();
    // Recompute on scroll/resize so handle stays glued to the image
    const editorEl = editorRef.current;
    editorEl.addEventListener('scroll', updateOverlay);
    window.addEventListener('scroll', updateOverlay, true);
    window.addEventListener('resize', updateOverlay);
    const observer = new MutationObserver(updateOverlay);
    observer.observe(editorRef.current, { childList: true, subtree: true, attributes: true });
    return () => {
      observer.disconnect();
      editorEl.removeEventListener('scroll', updateOverlay);
      window.removeEventListener('scroll', updateOverlay, true);
      window.removeEventListener('resize', updateOverlay);
    };
  }, [resizingImg]);

  return (
    <div className={cn('border rounded-md overflow-visible', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/30">
        <ToolbarButton onClick={() => { saveSelection(); execCommand('bold'); }} title="In đậm">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => { saveSelection(); execCommand('italic'); }} title="In nghiêng">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => { saveSelection(); execCommand('underline'); }} title="Gạch chân">
          <Underline className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => execCommand('justifyLeft')} title="Căn trái">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('justifyCenter')} title="Căn giữa">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('justifyRight')} title="Căn phải">
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Bullet list with style dropdown */}
        <div className="flex items-center">
          <ToolbarButton onClick={() => { saveSelection(); execCommand('insertUnorderedList'); }} title="Danh sách dấu chấm">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-muted transition-colors"
                title="Chọn kiểu đầu dòng"
                onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="start">
              <div className="grid grid-cols-1 gap-0.5">
                {[
                  { label: '● Chấm tròn đặc', val: 'disc' },
                  { label: '○ Chấm tròn rỗng', val: 'circle' },
                  { label: '■ Hình vuông', val: 'square' },
                  { label: '— Không dấu', val: 'none' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => applyListStyle(false, opt.val)}
                    className="text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Ordered list with style dropdown */}
        <div className="flex items-center">
          <ToolbarButton onClick={() => { saveSelection(); execCommand('insertOrderedList'); }} title="Danh sách số">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-muted transition-colors"
                title="Chọn kiểu số thứ tự"
                onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="start">
              <div className="grid grid-cols-1 gap-0.5">
                {[
                  { label: '1. 2. 3.', val: 'decimal' },
                  { label: 'a. b. c.', val: 'lower-alpha' },
                  { label: 'A. B. C.', val: 'upper-alpha' },
                  { label: 'i. ii. iii.', val: 'lower-roman' },
                  { label: 'I. II. III.', val: 'upper-roman' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => applyListStyle(true, opt.val)}
                    className="text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <ToolbarButton onClick={() => execCommand('formatBlock', '<h3>')} title="Tiêu đề">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Font family */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="px-2 py-1 rounded hover:bg-muted transition-colors text-xs flex items-center gap-1 border border-border min-w-[90px] justify-between"
              title="Phông chữ"
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
            >
              <span className="truncate">Phông</span>
              <span className="opacity-60">▾</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1 max-h-72 overflow-y-auto" align="start">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f.label}
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                style={{ fontFamily: f.value || undefined }}
                onClick={() => {
                  if (!f.value) {
                    restoreSelection();
                    execCommand('removeFormat');
                  } else {
                    applyInlineStyle('fontFamily', f.value);
                  }
                }}
              >
                {f.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Font size */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="px-2 py-1 rounded hover:bg-muted transition-colors text-xs flex items-center gap-1 border border-border min-w-[64px] justify-between"
              title="Cỡ chữ"
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
            >
              <Type className="h-3.5 w-3.5" />
              <span className="opacity-60">▾</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-24 p-1 max-h-72 overflow-y-auto" align="start">
            {FONT_SIZES_PX.map((px) => (
              <button
                key={px}
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                onClick={() => applyInlineStyle('fontSize', `${px}px`)}
              >
                {px}px
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors" title="Màu chữ" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}>
              <Palette className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-6 gap-1.5">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="w-6 h-6 rounded-full border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => { restoreSelection(); execCommand('foreColor', color); }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Gộp các ảnh liền nhau thành 1 hàng */}
        <ToolbarButton onClick={mergeAllImageBlocks} title="Gộp các ảnh liền nhau thành 1 hàng">
          <Rows className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={(open) => { if (open) saveSelection(); setLinkOpen(open); }}>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors" title="Chèn link" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}>
              <Link className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-2">
              <p className="text-xs font-medium">Chèn liên kết</p>
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && insertLink()}
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={insertLink} className="w-full h-7 text-xs">
                Chèn
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Image */}
        <Popover open={imageOpen} onOpenChange={(open) => { if (open) saveSelection(); setImageOpen(open); }}>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors" title="Chèn ảnh" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}>
              <Image className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-1.5">Tải ảnh từ máy</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-8 text-xs"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                  {uploading ? 'Đang tải...' : 'Chọn nhiều ảnh từ máy'}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">Chọn nhiều ảnh cùng lúc → chèn trên 1 hàng</p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-popover px-2 text-muted-foreground">hoặc</span></div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1.5">Chèn từ URL</p>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && insertImage()}
                  className="h-8 text-sm"
                />
                <Button size="sm" onClick={insertImage} className="w-full h-7 text-xs mt-1.5">
                  Chèn
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Cell background color (Tô màu ô như Word) */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted transition-colors"
              title="Tô màu nền ô (quét chọn ô trước)"
              onMouseDown={(e) => e.preventDefault()}
            >
              <PaintBucket className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
              Tô màu nền ô bảng
            </p>
            <div className="grid grid-cols-8 gap-1">
              {[
                '#fef3c7', '#fee2e2', '#dcfce7', '#dbeafe', '#ede9fe', '#fce7f3', '#f3f4f6', '#fed7aa',
                '#fde68a', '#fca5a5', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4', '#d1d5db', '#fdba74',
              ].map((bg) => (
                <button
                  key={bg}
                  type="button"
                  title="Tô màu ô đã chọn"
                  onClick={() => setCellsBackground(bg)}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ background: bg }}
                />
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] w-full mt-2"
              onClick={() => setCellsBackground(null)}
            >
              Xoá màu nền
            </Button>
          </PopoverContent>
        </Popover>

        {/* Table picker */}
        <Popover open={tableOpen} onOpenChange={(open) => { if (open) saveSelection(); setTableOpen(open); }}>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors" title="Chèn bảng" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}>
              <TableIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <p className="text-xs font-medium mb-2">
              Chèn bảng {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols}` : '(rê chuột để chọn kích thước)'}
            </p>
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: 'repeat(8, 18px)' }}
              onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}
            >
              {Array.from({ length: 8 * 8 }).map((_, i) => {
                const r = Math.floor(i / 8) + 1;
                const c = (i % 8) + 1;
                const active = r <= tableHover.rows && c <= tableHover.cols;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setTableHover({ rows: r, cols: c })}
                    onClick={() => insertTable(r, c)}
                    className="w-[18px] h-[18px] border cursor-pointer rounded-sm"
                    style={{
                      background: active ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      borderColor: active ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-3 pt-2 border-t space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Sửa bảng (đặt con trỏ vào ô)</p>
              <div className="grid grid-cols-2 gap-1">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => tableAction('addRow')}>
                  <Plus className="h-3 w-3 mr-1" />Thêm dòng
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => tableAction('delRow')}>
                  <Minus className="h-3 w-3 mr-1" />Xóa dòng
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => tableAction('addCol')}>
                  <Plus className="h-3 w-3 mr-1" />Thêm cột
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => tableAction('delCol')}>
                  <Minus className="h-3 w-3 mr-1" />Xóa cột
                </Button>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[11px] w-full text-destructive" onClick={() => tableAction('delTable')}>
                Xóa cả bảng
              </Button>
              <div className="pt-2 mt-2 border-t">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <PaintBucket className="h-3 w-3" />
                  Tô màu nền ô (quét chọn nhiều ô rồi bấm)
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {[
                    '#fef3c7', '#fee2e2', '#dcfce7', '#dbeafe', '#ede9fe', '#fce7f3', '#f3f4f6', '#fed7aa',
                    '#fde68a', '#fca5a5', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4', '#d1d5db', '#fdba74',
                  ].map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      title="Tô màu các ô đã chọn"
                      onClick={() => setCellsBackground(bg)}
                      className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                      style={{ background: bg }}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] w-full mt-1.5"
                  onClick={() => setCellsBackground(null)}
                >
                  Xoá màu nền
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => execCommand('undo')} title="Hoàn tác">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('redo')} title="Làm lại">
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>


      {/* Editor area */}
      <div className="relative">
        <div
          ref={handleRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onBlur={saveSelection}
          onClick={handleEditorClick}
          onMouseDown={handleEditorMouseDown}
          onKeyDown={handleEditorKeyDown}
          className="rte-editor-area p-3 text-sm focus:outline-none overflow-auto prose prose-sm max-w-none rounded-b-md"
          style={{ minHeight, resize: 'both' as any, maxHeight: '80vh', minWidth: '100%' }}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
        {/* Visual hint cho resize handle góc dưới-phải editor */}
        <div
          aria-hidden
          title="Kéo để đổi kích thước khung soạn thảo"
          style={{
            position: 'absolute',
            right: 2,
            bottom: 2,
            width: 14,
            height: 14,
            pointerEvents: 'none',
            background:
              'linear-gradient(135deg, transparent 0 6px, hsl(var(--muted-foreground) / 0.5) 6px 7px, transparent 7px 9px, hsl(var(--muted-foreground) / 0.5) 9px 10px, transparent 10px)',
            zIndex: 5,
          }}
        />

        {/* Resize overlay */}
        {resizingImg && resizeOverlay && (
          <div
            style={{
              position: 'absolute',
              top: resizeOverlay.top,
              left: resizeOverlay.left,
              width: resizeOverlay.width,
              height: resizeOverlay.height,
              pointerEvents: 'none',
              border: '2px solid hsl(var(--primary))',
              borderRadius: '8px',
              zIndex: 10,
            }}
          >
            {/* Resize handle bottom-right */}
            <div
              style={{
                position: 'absolute',
                bottom: -6,
                right: -6,
                width: 14,
                height: 14,
                background: 'hsl(var(--primary))',
                borderRadius: '50%',
                cursor: 'nwse-resize',
                pointerEvents: 'auto',
                border: '2px solid white',
              }}
              onMouseDown={handleResizeStart}
              onTouchStart={handleTouchResizeStart}
            />
          </div>
        )}

        {/* Table column/row resize handles */}
        {activeTable && tableHandles && (
          <>
            {tableHandles.cols.map((c) => (
              <div
                key={`col-${c.index}`}
                title="Kéo để đổi rộng cột"
                onMouseDown={(e) => startColResize(e, c.index)}
                onTouchStart={(e) => startColResize(e, c.index)}
                style={{
                  position: 'absolute',
                  top: c.top,
                  left: c.left - 3,
                  width: 6,
                  height: c.height,
                  cursor: 'col-resize',
                  background: 'hsl(var(--primary) / 0.0)',
                  borderLeft: '2px solid hsl(var(--primary) / 0.6)',
                  zIndex: 11,
                }}
              />
            ))}
            {tableHandles.rows.map((r) => (
              <div
                key={`row-${r.index}`}
                title="Kéo để đổi cao hàng"
                onMouseDown={(e) => startRowResize(e, r.index)}
                onTouchStart={(e) => startRowResize(e, r.index)}
                style={{
                  position: 'absolute',
                  top: r.top - 3,
                  left: r.left,
                  width: r.width,
                  height: 6,
                  cursor: 'row-resize',
                  background: 'hsl(var(--primary) / 0.0)',
                  borderTop: '2px solid hsl(var(--primary) / 0.6)',
                  zIndex: 11,
                }}
              />
            ))}
            {tableHandles.corner && (
              <div
                title="Kéo để đổi kích thước cả bảng"
                onMouseDown={startTableResize}
                onTouchStart={startTableResize}
                style={{
                  position: 'absolute',
                  top: tableHandles.corner.top - 7,
                  left: tableHandles.corner.left - 7,
                  width: 14,
                  height: 14,
                  cursor: 'nwse-resize',
                  background: 'hsl(var(--primary))',
                  border: '2px solid white',
                  borderRadius: 3,
                  zIndex: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            )}
          </>
        )}
      </div>

      <style>{`
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          opacity: 0.5;
          pointer-events: none;
        }
        [contenteditable] img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          cursor: pointer;
        }
        [contenteditable] a {
          color: hsl(var(--primary));
          text-decoration: underline;
        }
        [contenteditable] table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
          table-layout: fixed;
        }
        [contenteditable] table td,
        [contenteditable] table th {
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          vertical-align: middle;
          word-wrap: break-word;
          min-width: 40px;
        }
        [contenteditable] table th {
          background: #f3f4f6;
          font-weight: 700;
          text-align: center;
        }
        [contenteditable] table tr:nth-child(even) td:not([style*="background"]):not([bgcolor]) {
          background: #fafafa;
        }
        [contenteditable] td[data-rte-selected="true"],
        [contenteditable] th[data-rte-selected="true"] {
          outline: 2px solid hsl(var(--primary));
          outline-offset: -2px;
          background-color: hsl(var(--primary) / 0.12) !important;
        }
      `}</style>
    </div>
  );
}
