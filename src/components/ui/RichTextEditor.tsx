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
    onChange(editor.innerHTML || '');
  }, [onChange]);

  const handleInput = useCallback(() => {
    isInternalUpdate.current = true;
    onChange(editorRef.current?.innerHTML || '');
  }, [onChange]);

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
      exec('insertHTML', `<img src="${imageUrl.trim()}" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0" />`);
      setImageUrl('');
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

  const modifyTable = (action: 'addRow' | 'delRow' | 'addCol' | 'delCol' | 'delTable') => {
    const cell = findParentCell();
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = cell.closest('table');
    if (!row || !table) return;
    const colIndex = cell.cellIndex;

    if (action === 'addRow') {
      const newRow = row.cloneNode(true) as HTMLTableRowElement;
      Array.from(newRow.cells).forEach(c => {
        c.innerHTML = '&nbsp;';
        if (c.tagName === 'TH') {
          // convert TH to TD when adding below header
          const td = document.createElement('td');
          td.setAttribute('style', 'border:1px solid hsl(var(--border));padding:8px;min-width:60px');
          td.innerHTML = '&nbsp;';
          c.replaceWith(td);
        }
      });
      row.after(newRow);
    } else if (action === 'delRow') {
      if (table.rows.length > 1) row.remove();
    } else if (action === 'addCol') {
      Array.from(table.rows).forEach((r, idx) => {
        const tag = idx === 0 && r.cells[0]?.tagName === 'TH' ? 'th' : 'td';
        const newCell = document.createElement(tag);
        newCell.setAttribute('style', tag === 'th'
          ? 'border:1px solid hsl(var(--border));padding:8px;background:hsl(var(--muted));font-weight:600;text-align:left;min-width:60px'
          : 'border:1px solid hsl(var(--border));padding:8px;min-width:60px');
        newCell.innerHTML = '&nbsp;';
        const ref = r.cells[colIndex];
        if (ref?.nextSibling) r.insertBefore(newCell, ref.nextSibling);
        else r.appendChild(newCell);
      });
    } else if (action === 'delCol') {
      if (table.rows[0]?.cells.length > 1) {
        Array.from(table.rows).forEach(r => { if (r.cells[colIndex]) r.deleteCell(colIndex); });
      }
    } else if (action === 'delTable') {
      table.remove();
    }
    isInternalUpdate.current = true;
    onChange(editorRef.current?.innerHTML || '');
  };

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
          <PopoverContent className="w-64 p-2" align="start">
            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="URL ảnh..." className="text-sm mb-2" onKeyDown={e => e.key === 'Enter' && handleInsertImage()} />
            <Button size="sm" className="w-full" onClick={handleInsertImage}>Chèn ảnh</Button>
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
      <div
        ref={editorRef}
        contentEditable
        className="p-3 text-sm outline-none prose prose-sm dark:prose-invert max-w-none overflow-y-auto"
        style={{ minHeight }}
        onInput={handleInput}
        onBlur={saveSelection}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}
