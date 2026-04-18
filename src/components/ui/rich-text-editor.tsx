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


  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE) {
      toast({
        title: 'Ảnh quá lớn',
        description: 'Vui lòng chọn ảnh tối đa 15MB.',
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.type && !ALLOWED_UPLOAD_MIME_TYPES.has(file.type.toLowerCase())) {
      toast({
        title: 'Định dạng ảnh chưa hỗ trợ',
        description: 'Vui lòng chọn JPG, PNG, GIF, WEBP, HEIC hoặc AVIF.',
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Save selection BEFORE async operation
    saveSelection();
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `editor/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from('tenant-assets')
        .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
      if (!urlData?.publicUrl) throw new Error('Không lấy được URL ảnh');

      insertImageHtml(urlData.publicUrl);
      setImageOpen(false);
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast({
        title: 'Upload ảnh thất bại',
        description: err?.message || 'Vui lòng thử lại.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [insertImageHtml, saveSelection]);

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
      setTableHandles({ cols, rows });
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
        top: imgRect.top - editorRect.top + editorRef.current.scrollTop,
        left: imgRect.left - editorRect.left + editorRef.current.scrollLeft,
        width: imgRect.width,
        height: imgRect.height,
      });
    };
    updateOverlay();
    const observer = new MutationObserver(updateOverlay);
    observer.observe(editorRef.current, { childList: true, subtree: true, attributes: true });
    return () => observer.disconnect();
  }, [resizingImg]);

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
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

        <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Danh sách">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Danh sách số">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
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
                  {uploading ? 'Đang tải...' : 'Chọn ảnh từ máy'}
                </Button>
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
          className="p-3 text-sm focus:outline-none overflow-auto prose prose-sm max-w-none"
          style={{ minHeight }}
          data-placeholder={placeholder}
          suppressContentEditableWarning
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
        [contenteditable] table tr:nth-child(even) td {
          background: #fafafa;
        }
      `}</style>
    </div>
  );
}
