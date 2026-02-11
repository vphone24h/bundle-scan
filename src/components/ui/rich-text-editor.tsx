import React, { useRef, useCallback, useState } from 'react';
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
} from 'lucide-react';

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

const FONT_SIZES = [
  { label: 'Nhỏ', value: '2' },
  { label: 'Bình thường', value: '3' },
  { label: 'Lớn', value: '4' },
  { label: 'Rất lớn', value: '5' },
];

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
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    // Trigger change
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Allow pasting HTML content
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      document.execCommand('insertHTML', false, html);
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }
  }, [onChange]);

  const insertLink = useCallback(() => {
    if (linkUrl) {
      execCommand('createLink', linkUrl);
      // Make link open in new tab
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
  }, [linkUrl, execCommand, onChange]);

  const insertImage = useCallback(() => {
    if (imageUrl) {
      execCommand('insertHTML', `<img src="${imageUrl}" alt="image" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;" />`);
      setImageUrl('');
      setImageOpen(false);
    }
  }, [imageUrl, execCommand]);

  // Set initial content
  const handleRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      (editorRef as React.MutableRefObject<HTMLDivElement>).current = el;
      if (el.innerHTML !== value && value) {
        el.innerHTML = value;
      }
    }
  }, []); // Only run once on mount

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/30">
        <ToolbarButton onClick={() => execCommand('bold')} title="In đậm">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('italic')} title="In nghiêng">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('underline')} title="Gạch chân">
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

        {/* Font size */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors" title="Cỡ chữ">
              <Type className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="start">
            {FONT_SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                onClick={() => execCommand('fontSize', size.value)}
              >
                {size.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors" title="Màu chữ">
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
                  onClick={() => execCommand('foreColor', color)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors" title="Chèn link">
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
        <Popover open={imageOpen} onOpenChange={setImageOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors" title="Chèn ảnh">
              <Image className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-2">
              <p className="text-xs font-medium">Chèn ảnh (URL)</p>
              <Input
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && insertImage()}
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={insertImage} className="w-full h-7 text-xs">
                Chèn
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
      <div
        ref={handleRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="p-3 text-sm focus:outline-none overflow-auto prose prose-sm max-w-none"
        style={{ minHeight }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

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
        }
        [contenteditable] a {
          color: hsl(var(--primary));
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
