 import { useState, useEffect, useRef } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { useTaxPolicyArticle, useUpdateTaxPolicyArticle } from '@/hooks/useTaxPolicyArticle';
 import { 
   Save, 
   Loader2, 
   AlignLeft, 
   AlignCenter, 
   AlignRight, 
   Image as ImageIcon,
   Bold,
   Italic,
   List,
   FileText,
   Trash2,
  Maximize2,
  Link as LinkIcon
 } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
 import {
   Popover,
   PopoverContent,
   PopoverTrigger,
 } from '@/components/ui/popover';
 
 export function TaxPolicyArticleEditor() {
   const { data: article, isLoading } = useTaxPolicyArticle();
   const updateArticle = useUpdateTaxPolicyArticle();
   
   const [title, setTitle] = useState('Mức Thuế 2026');
   const [content, setContent] = useState('');
   const [uploading, setUploading] = useState(false);
   const editorRef = useRef<HTMLDivElement>(null);
   const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
   const [imageWidth, setImageWidth] = useState('100');
   const [showImagePopover, setShowImagePopover] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [savedRange, setSavedRange] = useState<Range | null>(null);
 
   useEffect(() => {
     if (article) {
       setTitle(article.title || 'Mức Thuế 2026');
       setContent(article.content || '');
     }
   }, [article]);
 
   // Sync content state from editor
   useEffect(() => {
     if (editorRef.current && content && !editorRef.current.innerHTML) {
       editorRef.current.innerHTML = content;
     }
   }, [content]);
 
   // Handle image click in editor
   useEffect(() => {
     const editor = editorRef.current;
     if (!editor) return;
 
     const handleImageClick = (e: MouseEvent) => {
       const target = e.target as HTMLElement;
       if (target.tagName === 'IMG') {
         e.preventDefault();
        e.stopPropagation();
         const img = target as HTMLImageElement;
         setSelectedImage(img);
         // Get current width as percentage or px
         const currentWidth = img.style.width || '100%';
         setImageWidth(currentWidth.replace('%', '').replace('px', ''));
         setShowImagePopover(true);
        setShowLinkDialog(false); // Close link dialog if open
       }
     };
 
    // Use mousedown for better detection before focus changes
    editor.addEventListener('mousedown', handleImageClick);
    return () => editor.removeEventListener('mousedown', handleImageClick);
   }, []);
 
  // Handle right-click context menu for link insertion
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleContextMenu = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        e.preventDefault();
        // Save the selection
        const range = selection.getRangeAt(0);
        setSavedRange(range.cloneRange());
        setSelectedText(selection.toString());
        setLinkUrl('');
        setShowLinkDialog(true);
      }
    };

    editor.addEventListener('contextmenu', handleContextMenu);
    return () => editor.removeEventListener('contextmenu', handleContextMenu);
  }, []);

   const handleImageResize = (width: string) => {
     if (selectedImage) {
       selectedImage.style.width = `${width}%`;
       selectedImage.style.height = 'auto';
       setImageWidth(width);
     }
   };
 
   const handleDeleteImage = () => {
     if (selectedImage) {
       selectedImage.remove();
       setSelectedImage(null);
       setShowImagePopover(false);
       toast.success('Đã xóa ảnh');
     }
   };
 
  const handleInsertLink = () => {
    if (!linkUrl.trim()) {
      toast.error('Vui lòng nhập URL');
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    // Ensure URL has protocol
    let finalUrl = linkUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    if (savedRange) {
      // Restore selection
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
        
        // Create link element
        const link = document.createElement('a');
        link.href = finalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'text-primary underline hover:text-primary/80';
        link.textContent = selectedText || finalUrl;
        
        // Replace selection with link
        savedRange.deleteContents();
        savedRange.insertNode(link);
        
        // Move cursor after link
        const newRange = document.createRange();
        newRange.setStartAfter(link);
        newRange.setEndAfter(link);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      // No selection, insert link at cursor or end
      editor.focus();
      const link = document.createElement('a');
      link.href = finalUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'text-primary underline hover:text-primary/80';
      link.textContent = finalUrl;
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          range.insertNode(link);
          range.setStartAfter(link);
          range.setEndAfter(link);
        } else {
          editor.appendChild(link);
        }
      } else {
        editor.appendChild(link);
      }
    }

    setShowLinkDialog(false);
    setLinkUrl('');
    setSelectedText('');
    setSavedRange(null);
    toast.success('Đã chèn link thành công');
  };

  const openLinkDialog = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      setSavedRange(range.cloneRange());
      setSelectedText(selection.toString());
    } else {
      setSavedRange(null);
      setSelectedText('');
    }
    setLinkUrl('');
    setShowLinkDialog(true);
  };

   const handleSave = () => {
     const htmlContent = editorRef.current?.innerHTML || '';
     updateArticle.mutate({ title, content: htmlContent });
   };
 
   const execCommand = (command: string, value?: string) => {
     document.execCommand(command, false, value);
     editorRef.current?.focus();
   };
 
   const insertImageAtCursor = (imageUrl: string) => {
     const editor = editorRef.current;
     if (!editor) return;
 
     // Focus the editor first
     editor.focus();
 
     // Create image element
     const img = document.createElement('img');
     img.src = imageUrl;
     img.style.maxWidth = '100%';
     img.style.height = 'auto';
     img.style.borderRadius = '8px';
     img.style.margin = '8px 0';
     img.style.display = 'block';
 
     // Get selection
     const selection = window.getSelection();
     if (selection && selection.rangeCount > 0) {
       const range = selection.getRangeAt(0);
       // Check if selection is within editor
       if (editor.contains(range.commonAncestorContainer)) {
         range.deleteContents();
         range.insertNode(img);
         // Move cursor after image
         range.setStartAfter(img);
         range.setEndAfter(img);
         selection.removeAllRanges();
         selection.addRange(range);
         return;
       }
     }
 
     // Fallback: append to end of editor
     editor.appendChild(img);
   };
 
   const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
 
     setUploading(true);
     try {
       const fileExt = file.name.split('.').pop();
       const fileName = `platform/tax-policy/${Date.now()}.${fileExt}`;
       
       const { error: uploadError } = await supabase.storage
         .from('tenant-assets')
         .upload(fileName, file);
 
       if (uploadError) throw uploadError;
 
       const { data: urlData } = supabase.storage
         .from('tenant-assets')
         .getPublicUrl(fileName);
 
       // Insert image at cursor position using direct DOM manipulation
       insertImageAtCursor(urlData.publicUrl);
       toast.success('Đã tải ảnh lên thành công');
     } catch (error: any) {
       toast.error('Lỗi tải ảnh: ' + error.message);
     } finally {
       setUploading(false);
       e.target.value = '';
     }
   };
 
   if (isLoading) {
     return (
       <div className="flex items-center justify-center p-8">
         <Loader2 className="h-6 w-6 animate-spin" />
       </div>
     );
   }
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <CardTitle className="text-base flex items-center gap-2">
           <FileText className="h-4 w-4" />
           Bài viết Mức Thuế 2026
         </CardTitle>
         <CardDescription>
           Cấu hình nội dung bài viết hiển thị trong menu Xuất hàng
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-4">
         <div className="space-y-2">
           <Label htmlFor="article-title">Tiêu đề</Label>
           <Input
             id="article-title"
             value={title}
             onChange={(e) => setTitle(e.target.value)}
             placeholder="Mức Thuế 2026"
           />
         </div>
 
         <div className="space-y-2">
           <Label>Nội dung</Label>
           
           {/* Toolbar */}
           <div className="flex flex-wrap items-center gap-1 p-2 border rounded-t-md bg-muted/50">
             <Button
               type="button"
               variant="ghost"
               size="sm"
               onClick={() => execCommand('bold')}
               className="h-8 w-8 p-0"
             >
               <Bold className="h-4 w-4" />
             </Button>
             <Button
               type="button"
               variant="ghost"
               size="sm"
               onClick={() => execCommand('italic')}
               className="h-8 w-8 p-0"
             >
               <Italic className="h-4 w-4" />
             </Button>
             
             <div className="w-px h-6 bg-border mx-1" />
             
             <ToggleGroup type="single" size="sm">
               <ToggleGroupItem
                 value="left"
                 onClick={() => execCommand('justifyLeft')}
                 className="h-8 w-8 p-0"
               >
                 <AlignLeft className="h-4 w-4" />
               </ToggleGroupItem>
               <ToggleGroupItem
                 value="center"
                 onClick={() => execCommand('justifyCenter')}
                 className="h-8 w-8 p-0"
               >
                 <AlignCenter className="h-4 w-4" />
               </ToggleGroupItem>
               <ToggleGroupItem
                 value="right"
                 onClick={() => execCommand('justifyRight')}
                 className="h-8 w-8 p-0"
               >
                 <AlignRight className="h-4 w-4" />
               </ToggleGroupItem>
             </ToggleGroup>
             
             <div className="w-px h-6 bg-border mx-1" />
             
             <Button
               type="button"
               variant="ghost"
               size="sm"
               onClick={() => execCommand('insertUnorderedList')}
               className="h-8 w-8 p-0"
             >
               <List className="h-4 w-4" />
             </Button>
             
             <div className="w-px h-6 bg-border mx-1" />
             
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openLinkDialog}
              className="h-8 px-2 gap-1"
              title="Chèn link (hoặc chọn text và nhấn chuột phải)"
            >
              <LinkIcon className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Link</span>
            </Button>
            
             <label className="cursor-pointer">
               <Button
                 type="button"
                 variant="ghost"
                 size="sm"
                 className="h-8 px-2 gap-1"
                 disabled={uploading}
                 asChild
               >
                 <span>
                   {uploading ? (
                     <Loader2 className="h-4 w-4 animate-spin" />
                   ) : (
                     <ImageIcon className="h-4 w-4" />
                   )}
                   <span className="text-xs hidden sm:inline">Thêm ảnh</span>
                 </span>
               </Button>
               <input
                 type="file"
                 accept="image/*"
                 className="hidden"
                 onChange={handleImageUpload}
                 disabled={uploading}
               />
             </label>
           </div>
 
           {/* Content Editable Area */}
           <div
             ref={editorRef}
             contentEditable
             className="min-h-[300px] p-4 border border-t-0 rounded-b-md bg-background focus:outline-none focus:ring-2 focus:ring-ring
              [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 [&_img]:cursor-pointer [&_img:hover]:ring-2 [&_img:hover]:ring-primary [&_img]:select-none"
             dangerouslySetInnerHTML={{ __html: content }}
          onClick={(e) => {
            // Handle click outside of images to deselect
            const target = e.target as HTMLElement;
            if (target.tagName !== 'IMG' && showImagePopover) {
              setShowImagePopover(false);
              setSelectedImage(null);
            }
             }}
           />
         </div>
 
         {/* Image resize popover */}
         {showImagePopover && selectedImage && (
          <div className="p-3 border rounded-lg bg-accent/50 border-primary/20 space-y-3">
             <div className="flex items-center justify-between">
               <Label className="text-sm font-medium flex items-center gap-2">
                 <Maximize2 className="h-4 w-4" />
                 Chỉnh kích thước ảnh
               </Label>
               <Button
                 type="button"
                 variant="ghost"
                 size="sm"
                onClick={() => {
                  setShowImagePopover(false);
                  setSelectedImage(null);
                }}
                 className="h-6 w-6 p-0 text-muted-foreground"
               >
                 ✕
               </Button>
             </div>
            
            <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
              💡 Click vào ảnh trong editor để chọn và chỉnh kích thước
            </div>
             
             <div className="flex items-center gap-2">
               <Label className="text-xs w-16">Chiều rộng:</Label>
               <Input
                 type="number"
                 value={imageWidth}
                 onChange={(e) => handleImageResize(e.target.value)}
                 className="w-20 h-8 text-sm"
                 min="10"
                 max="100"
               />
               <span className="text-sm text-muted-foreground">%</span>
             </div>
 
             <div className="flex gap-1 flex-wrap">
               {['25', '50', '75', '100'].map((size) => (
                 <Button
                   key={size}
                   type="button"
                   variant={imageWidth === size ? 'default' : 'outline'}
                   size="sm"
                   onClick={() => handleImageResize(size)}
                   className="h-7 px-2 text-xs"
                 >
                   {size}%
                 </Button>
               ))}
             </div>
 
             <Button
               type="button"
               variant="destructive"
               size="sm"
               onClick={handleDeleteImage}
               className="w-full h-8 gap-1"
             >
               <Trash2 className="h-3 w-3" />
               Xóa ảnh
             </Button>
           </div>
         )}
 
        {/* Link insertion dialog */}
        {showLinkDialog && (
          <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Chèn liên kết
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                  setSelectedText('');
                  setSavedRange(null);
                }}
                className="h-6 w-6 p-0 text-muted-foreground"
              >
                ✕
              </Button>
            </div>
            
            {selectedText && (
              <div className="text-sm text-muted-foreground">
                Text đã chọn: <span className="font-medium text-foreground">"{selectedText}"</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Label className="text-xs w-12">URL:</Label>
              <Input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInsertLink();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                  setSelectedText('');
                  setSavedRange(null);
                }}
                className="flex-1 h-8"
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleInsertLink}
                className="flex-1 h-8 gap-1"
              >
                <LinkIcon className="h-3 w-3" />
                Chèn link
              </Button>
            </div>
          </div>
        )}

         <div className="flex justify-end pt-2">
           <Button onClick={handleSave} disabled={updateArticle.isPending}>
             {updateArticle.isPending ? (
               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
             ) : (
               <Save className="h-4 w-4 mr-2" />
             )}
             Lưu bài viết
           </Button>
         </div>
       </CardContent>
     </Card>
   );
 }