import { useRef, useCallback, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Link, Image, Video, Palette, List, ListOrdered, Table as TableIcon,
  Plus, Minus, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  onUpload?: (file: File) => Promise<string>;
}

const COLORS = [
  '#000000', '#e53e3e', '#dd6b20', '#d69e2e', '#38a169',
  '#3182ce', '#805ad5', '#d53f8c', '#718096', '#ffffff',
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Nhập nội dung...',
  className,
  minHeight = '120px',
  onUpload,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [videoPopoverOpen, setVideoPopoverOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });
  const [uploadingImages, setUploadingImages] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const isInternalUpdate = useRef(false);

  // Sync external value only on first mount or when value changes externally
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    isInternalUpdate.current = false;
  }, [value]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
  }, []);

  const exec = useCallback((command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    // Try to restore selection; if it fails, place cursor at end
    const sel = window.getSelection();
    if (savedSelectionRef.current && editor.contains(savedSelectionRef.current.commonAncestorContainer)) {
      sel?.removeAllRanges();
      sel?.addRange(savedSelectionRef.current);
    } else {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    document.execCommand(command, false, value);
    isInternalUpdate.current = true;
    onChange(getCleanHTML());
    setTimeout(() => attachResizeHandlesRef.current?.(), 0);
  }, [onChange]);

  // Strip resize handles before persisting
  const getCleanHTML = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return '';
    const clone = editor.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.rte-col-resize, .rte-row-resize').forEach(el => el.remove());
    return clone.innerHTML;
  }, []);

  const handleInput = useCallback(() => {
    isInternalUpdate.current = true;
    onChange(getCleanHTML());
  }, [onChange, getCleanHTML]);

  const attachResizeHandlesRef = useRef<(() => void) | null>(null);
  const positionImageOverlayRef = useRef<((img: HTMLImageElement | null) => void) | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const selectedImgRef = useRef<HTMLImageElement | null>(null);

  const toolbarBtn = (icon: React.ReactNode, command: string, title: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
      onClick={() => exec(command)}
    >
      {icon}
    </Button>
  );

  const handleInsertLink = () => {
    if (linkUrl.trim()) {
      restoreSelection();
      exec('createLink', linkUrl.trim());
      setLinkUrl('');
      setLinkPopoverOpen(false);
    }
  };

  const handleInsertImage = () => {
    if (imageUrl.trim()) {
      restoreSelection();
      exec('insertHTML', `<img src="${imageUrl.trim()}" class="rte-img" style="max-width:100%;height:auto;border-radius:8px;margin:8px 4px" />`);
      setImageUrl('');
      setImagePopoverOpen(false);
    }
  };

  const handleUploadImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !onUpload) return;
    setUploadingImages(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const url = await onUpload(file);
          if (url) urls.push(url);
        } catch (e) { /* skip */ }
      }
      if (urls.length > 0) {
        const inner = urls
          .map(u => `<img src="${u}" class="rte-img" style="display:inline-block;max-width:32%;height:auto;border-radius:8px;margin:4px;vertical-align:top" />`)
          .join('');
        const html = `<div class="rte-image-row" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">${inner}</div><p><br></p>`;
        restoreSelection();
        exec('insertHTML', html);
      }
    } finally {
      setUploadingImages(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
      setImagePopoverOpen(false);
    }
  };

  const buildTableHTML = (rows: number, cols: number) => {
    const colWidth = Math.floor(100 / cols);
    let html = '<table class="rte-table"><colgroup>';
    for (let c = 0; c < cols; c++) html += `<col style="width:${colWidth}%" />`;
    html += '</colgroup><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? 'th' : 'td';
        html += `<${tag}>&nbsp;</${tag}>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    return html;
  };

  const handleInsertTable = (rows: number, cols: number) => {
    if (rows < 1 || cols < 1) return;
    restoreSelection();
    exec('insertHTML', buildTableHTML(rows, cols));
    setTablePopoverOpen(false);
    setTableHover({ rows: 0, cols: 0 });
  };

  const findParentCell = (): HTMLTableCellElement | null => {
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
  };

  const ensureColgroup = (table: HTMLTableElement) => {
    let colgroup = table.querySelector('colgroup');
    const colCount = table.rows[0]?.cells.length || 0;
    if (!colgroup) {
      colgroup = document.createElement('colgroup');
      const w = Math.floor(100 / Math.max(colCount, 1));
      for (let i = 0; i < colCount; i++) {
        const col = document.createElement('col');
        col.style.width = `${w}%`;
        colgroup.appendChild(col);
      }
      table.insertBefore(colgroup, table.firstChild);
    }
    return colgroup;
  };

  const modifyTable = (action: 'addRow' | 'delRow' | 'addCol' | 'delCol' | 'delTable') => {
    const cell = findParentCell();
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!row || !table) return;
    const colIndex = cell.cellIndex;

    if (action === 'addRow') {
      const newRow = document.createElement('tr');
      const colCount = row.cells.length;
      for (let i = 0; i < colCount; i++) {
        const td = document.createElement('td');
        td.innerHTML = '&nbsp;';
        newRow.appendChild(td);
      }
      row.after(newRow);
    } else if (action === 'delRow') {
      if (table.rows.length > 1) row.remove();
    } else if (action === 'addCol') {
      Array.from(table.rows).forEach((r, idx) => {
        const tag = idx === 0 && r.cells[0]?.tagName === 'TH' ? 'th' : 'td';
        const newCell = document.createElement(tag);
        newCell.innerHTML = '&nbsp;';
        const ref = r.cells[colIndex];
        if (ref?.nextSibling) r.insertBefore(newCell, ref.nextSibling);
        else r.appendChild(newCell);
      });
      const colgroup = ensureColgroup(table);
      const newCol = document.createElement('col');
      const total = table.rows[0].cells.length;
      newCol.style.width = `${Math.floor(100 / total)}%`;
      colgroup.appendChild(newCol);
    } else if (action === 'delCol') {
      if (table.rows[0]?.cells.length > 1) {
        Array.from(table.rows).forEach(r => { if (r.cells[colIndex]) r.deleteCell(colIndex); });
        const cols = table.querySelectorAll('colgroup col');
        if (cols[colIndex]) cols[colIndex].remove();
      }
    } else if (action === 'delTable') {
      table.remove();
    }
    setTimeout(() => attachResizeHandlesRef.current?.(), 0);
    isInternalUpdate.current = true;
    onChange(getCleanHTML());
  };

  // ===== Resize handles for table columns & rows (Word-like drag) =====
  const attachResizeHandles = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const tables = editor.querySelectorAll('table.rte-table');
    tables.forEach((tbl) => {
      const table = tbl as HTMLTableElement;
      ensureColgroup(table);
      const firstRow = table.rows[0];
      if (firstRow) {
        Array.from(firstRow.cells).forEach((cell, idx) => {
          if (idx === firstRow.cells.length - 1) return;
          if (cell.querySelector('.rte-col-resize')) return;
          const handle = document.createElement('div');
          handle.className = 'rte-col-resize';
          handle.contentEditable = 'false';
          cell.appendChild(handle);
        });
      }
      Array.from(table.rows).forEach((row, rIdx) => {
        if (rIdx === table.rows.length - 1) return;
        const firstCell = row.cells[0];
        if (!firstCell || firstCell.querySelector('.rte-row-resize')) return;
        const handle = document.createElement('div');
        handle.className = 'rte-row-resize';
        handle.contentEditable = 'false';
        firstCell.appendChild(handle);
      });
    });
    // Mark images as resizable (cursor + class). Selection handle is added on click.
    editor.querySelectorAll('img').forEach(img => {
      if (!img.classList.contains('rte-img')) img.classList.add('rte-img');
    });
  }, []);

  attachResizeHandlesRef.current = attachResizeHandles;

  useEffect(() => {
    const t = setTimeout(attachResizeHandles, 50);
    return () => clearTimeout(t);
  }, [value, attachResizeHandles]);

  // ===== Image selection overlay with corner resize handles =====
  const positionImageOverlay = useCallback((img: HTMLImageElement | null) => {
    const overlay = overlayRef.current;
    const editor = editorRef.current;
    if (!overlay || !editor) return;
    if (!img) {
      overlay.style.display = 'none';
      selectedImgRef.current = null;
      return;
    }
    const eRect = editor.getBoundingClientRect();
    const iRect = img.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.left = `${iRect.left - eRect.left + editor.scrollLeft}px`;
    overlay.style.top = `${iRect.top - eRect.top + editor.scrollTop}px`;
    overlay.style.width = `${iRect.width}px`;
    overlay.style.height = `${iRect.height}px`;
  }, []);
  positionImageOverlayRef.current = positionImageOverlay;

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      selectedImgRef.current = img;
      positionImageOverlay(img);
      // Attach handlers to handles after positioning
      requestAnimationFrame(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        overlay.querySelectorAll('.rte-img-handle').forEach(h => {
          (h as any)._targetImg = img;
        });
      });
    } else if (!target.closest('.rte-img-overlay')) {
      positionImageOverlay(null);
    }
  }, [positionImageOverlay]);

  useEffect(() => {
    const onScrollOrResize = () => {
      if (selectedImgRef.current) positionImageOverlay(selectedImgRef.current);
    };
    window.addEventListener('resize', onScrollOrResize);
    const editor = editorRef.current;
    editor?.addEventListener('scroll', onScrollOrResize);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      editor?.removeEventListener('scroll', onScrollOrResize);
    };
  }, [positionImageOverlay]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isCol = target.classList.contains('rte-col-resize');
    const isRow = target.classList.contains('rte-row-resize');
    const isImgHandle = target.classList.contains('rte-img-handle');
    if (!isCol && !isRow && !isImgHandle) return;
    e.preventDefault();
    e.stopPropagation();

    if (isImgHandle) {
      const img = (target as any)._targetImg as HTMLImageElement | undefined;
      if (!img) return;
      const corner = target.dataset.corner || 'br';
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = img.offsetWidth;
      const startH = img.offsetHeight;
      const ratio = startW > 0 ? startH / startW : 1;
      const onMove = (ev: MouseEvent) => {
        let dx = ev.clientX - startX;
        if (corner.includes('l')) dx = -dx;
        const newW = Math.max(40, startW + dx);
        const newH = Math.max(40, newW * ratio);
        img.style.width = `${newW}px`;
        img.style.height = `${newH}px`;
        img.style.maxWidth = 'none';
        positionImageOverlayRef.current?.(img);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        isInternalUpdate.current = true;
        onChange(getCleanHTML());
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      return;
    }

    target.classList.add('active');

    const cell = target.closest('th, td') as HTMLTableCellElement | null;
    const table = target.closest('table') as HTMLTableElement | null;
    if (!cell || !table) return;

    const startX = e.clientX;
    const startY = e.clientY;

    if (isCol) {
      const colIndex = cell.cellIndex;
      const cols = table.querySelectorAll('colgroup col');
      const colEl = cols[colIndex] as HTMLElement | undefined;
      const nextColEl = cols[colIndex + 1] as HTMLElement | undefined;
      const tableWidth = table.offsetWidth;
      const startWidth = cell.offsetWidth;
      const nextCell = table.rows[0].cells[colIndex + 1];
      const nextStartWidth = nextCell?.offsetWidth || 0;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newW = Math.max(40, startWidth + dx);
        const newNextW = Math.max(40, nextStartWidth - dx);
        if (colEl) colEl.style.width = `${(newW / tableWidth) * 100}%`;
        if (nextColEl) nextColEl.style.width = `${(newNextW / tableWidth) * 100}%`;
      };
      const onUp = () => {
        target.classList.remove('active');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        isInternalUpdate.current = true;
        onChange(getCleanHTML());
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    } else {
      const row = cell.parentElement as HTMLTableRowElement;
      const startHeight = row.offsetHeight;
      const onMove = (ev: MouseEvent) => {
        const dy = ev.clientY - startY;
        const newH = Math.max(24, startHeight + dy);
        row.style.height = `${newH}px`;
      };
      const onUp = () => {
        target.classList.remove('active');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        isInternalUpdate.current = true;
        onChange(getCleanHTML());
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
  }, [onChange]);

  const handleInsertVideo = () => {
    if (videoUrl.trim()) {
      restoreSelection();
      let embedHtml = '';
      // YouTube
      const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (ytMatch) {
        embedHtml = `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:8px 0"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div>`;
      } else {
        embedHtml = `<video src="${videoUrl.trim()}" controls style="max-width:100%;margin:8px 0"></video>`;
      }
      exec('insertHTML', embedHtml);
      setVideoUrl('');
      setVideoPopoverOpen(false);
    }
  };

  return (
    <div className={cn('border rounded-md overflow-hidden bg-background', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/30">
        {toolbarBtn(<Bold className="h-3.5 w-3.5" />, 'bold', 'Đậm')}
        {toolbarBtn(<Italic className="h-3.5 w-3.5" />, 'italic', 'Nghiêng')}
        {toolbarBtn(<Underline className="h-3.5 w-3.5" />, 'underline', 'Gạch chân')}
        
        <div className="w-px h-5 bg-border mx-0.5" />
        
        {toolbarBtn(<AlignLeft className="h-3.5 w-3.5" />, 'justifyLeft', 'Căn trái')}
        {toolbarBtn(<AlignCenter className="h-3.5 w-3.5" />, 'justifyCenter', 'Căn giữa')}
        {toolbarBtn(<AlignRight className="h-3.5 w-3.5" />, 'justifyRight', 'Căn phải')}
        
        <div className="w-px h-5 bg-border mx-0.5" />
        
        {toolbarBtn(<List className="h-3.5 w-3.5" />, 'insertUnorderedList', 'Danh sách')}
        {toolbarBtn(<ListOrdered className="h-3.5 w-3.5" />, 'insertOrderedList', 'Đánh số')}

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Màu chữ" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}>
              <Palette className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-5 gap-1">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className="h-6 w-6 rounded border border-border cursor-pointer"
                  style={{ backgroundColor: color }}
                  onClick={() => exec('foreColor', color)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Link */}
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Chèn link" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}>
              <Link className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="text-sm mb-2" onKeyDown={e => e.key === 'Enter' && handleInsertLink()} />
            <Button size="sm" className="w-full" onClick={handleInsertLink}>Chèn link</Button>
          </PopoverContent>
        </Popover>

        {/* Image */}
        <Popover open={imagePopoverOpen} onOpenChange={setImagePopoverOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Chèn ảnh" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}>
              <Image className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 space-y-2" align="start">
            {onUpload && (
              <>
                <input
                  ref={imageFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUploadImageFiles(e.target.files)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={uploadingImages}
                  onClick={() => imageFileRef.current?.click()}
                >
                  {uploadingImages ? 'Đang tải lên...' : '📤 Tải nhiều ảnh (1 hàng)'}
                </Button>
                <div className="text-[10px] text-muted-foreground text-center">
                  Chọn nhiều ảnh cùng lúc — chèn trên cùng 1 dòng
                </div>
                <div className="border-t my-1" />
              </>
            )}
            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Hoặc dán URL ảnh..." className="text-sm" onKeyDown={e => e.key === 'Enter' && handleInsertImage()} />
            <Button size="sm" variant="outline" className="w-full" onClick={handleInsertImage}>Chèn từ URL</Button>
          </PopoverContent>
        </Popover>

        {/* Table */}
        <Popover open={tablePopoverOpen} onOpenChange={setTablePopoverOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Chèn bảng" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}>
              <TableIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="text-xs text-muted-foreground mb-1.5 text-center">
              {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols}` : 'Chọn kích thước'}
            </div>
            <div className="grid grid-cols-8 gap-0.5" onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}>
              {Array.from({ length: 8 }).map((_, r) =>
                Array.from({ length: 8 }).map((_, c) => {
                  const active = r < tableHover.rows && c < tableHover.cols;
                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      className={cn(
                        'h-4 w-4 border border-border cursor-pointer transition-colors',
                        active ? 'bg-primary border-primary' : 'bg-background hover:bg-muted'
                      )}
                      onMouseEnter={() => setTableHover({ rows: r + 1, cols: c + 1 })}
                      onClick={() => handleInsertTable(r + 1, c + 1)}
                    />
                  );
                })
              )}
            </div>
            <div className="border-t mt-2 pt-2 space-y-1">
              <div className="text-xs text-muted-foreground mb-1">Sửa bảng (đặt con trỏ vào ô):</div>
              <div className="grid grid-cols-2 gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => modifyTable('addRow')}>
                  <Plus className="h-3 w-3 mr-1" />Dòng
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => modifyTable('delRow')}>
                  <Minus className="h-3 w-3 mr-1" />Dòng
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => modifyTable('addCol')}>
                  <Plus className="h-3 w-3 mr-1" />Cột
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => modifyTable('delCol')}>
                  <Minus className="h-3 w-3 mr-1" />Cột
                </Button>
              </div>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs w-full text-destructive" onClick={() => modifyTable('delTable')}>
                <Trash2 className="h-3 w-3 mr-1" />Xóa bảng
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Video */}
        <Popover open={videoPopoverOpen} onOpenChange={setVideoPopoverOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Chèn video" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}>
              <Video className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="YouTube hoặc URL video..." className="text-sm mb-2" onKeyDown={e => e.key === 'Enter' && handleInsertVideo()} />
            <Button size="sm" className="w-full" onClick={handleInsertVideo}>Chèn video</Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Editor area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          className="rte-content p-3 text-sm outline-none prose prose-sm dark:prose-invert max-w-none overflow-y-auto"
          style={{ minHeight }}
          onInput={handleInput}
          onBlur={saveSelection}
          onMouseDown={handleResizeMouseDown}
          onClick={handleEditorClick}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
        {/* Image selection overlay (4 corner handles) */}
        <div
          ref={overlayRef}
          className="rte-img-overlay"
          style={{
            display: 'none',
            position: 'absolute',
            border: '2px dashed hsl(var(--primary))',
            pointerEvents: 'none',
            zIndex: 5,
          }}
          contentEditable={false}
        >
          {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
            <div
              key={corner}
              className="rte-img-handle"
              data-corner={corner}
              onMouseDown={handleResizeMouseDown as any}
              style={{
                position: 'absolute',
                width: 12,
                height: 12,
                background: 'hsl(var(--primary))',
                border: '2px solid white',
                borderRadius: '50%',
                pointerEvents: 'auto',
                cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
                top: corner.startsWith('t') ? -6 : undefined,
                bottom: corner.startsWith('b') ? -6 : undefined,
                left: corner.endsWith('l') ? -6 : undefined,
                right: corner.endsWith('r') ? -6 : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
