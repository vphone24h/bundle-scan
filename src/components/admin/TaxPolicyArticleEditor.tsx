 import { useState, useEffect, useRef } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
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
   FileText
 } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
 
 export function TaxPolicyArticleEditor() {
   const { data: article, isLoading } = useTaxPolicyArticle();
   const updateArticle = useUpdateTaxPolicyArticle();
   
   const [title, setTitle] = useState('Mức Thuế 2026');
   const [content, setContent] = useState('');
   const [uploading, setUploading] = useState(false);
   const editorRef = useRef<HTMLDivElement>(null);
 
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
 
   const handleSave = () => {
     const htmlContent = editorRef.current?.innerHTML || '';
     updateArticle.mutate({ title, content: htmlContent });
   };
 
   const execCommand = (command: string, value?: string) => {
     document.execCommand(command, false, value);
     editorRef.current?.focus();
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
 
       // Insert image at cursor position
       execCommand('insertImage', urlData.publicUrl);
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
               [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2"
             dangerouslySetInnerHTML={{ __html: content }}
             onBlur={() => {
               // Optional: auto-save on blur
             }}
           />
         </div>
 
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