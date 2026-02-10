 import { MainLayout } from '@/components/layout/MainLayout';
 import { PageHeader } from '@/components/layout/PageHeader';
 import { useTaxPolicyArticle } from '@/hooks/useTaxPolicyArticle';
 import { Loader2 } from 'lucide-react';
 import { Card, CardContent } from '@/components/ui/card';
 
 export default function TaxPolicyPage() {
   const { data: article, isLoading } = useTaxPolicyArticle();
 
   if (isLoading) {
     return (
       <MainLayout>
         <div className="flex items-center justify-center h-[50vh]">
           <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
         </div>
       </MainLayout>
     );
   }
 
   return (
     <MainLayout>
       <div className="p-4 sm:p-6">
         <PageHeader 
           title={article?.title || 'Mức Thuế 2026'} 
           description="Thông tin về mức thuế áp dụng năm 2026"
           helpText="Tra cứu mức thuế VAT theo ngành hàng áp dụng từ năm 2026. Giúp tính toán thuế chính xác khi xuất hóa đơn điện tử."
         />
         <Card className="mt-6">
           <CardContent className="p-4 sm:p-6">
             {article?.content ? (
               <div 
                 className="prose prose-sm sm:prose max-w-none dark:prose-invert
                   [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:mx-auto
                   [&_.text-center]:text-center [&_.text-right]:text-right [&_.text-left]:text-left"
                 dangerouslySetInnerHTML={{ __html: article.content }}
               />
             ) : (
               <div className="text-center text-muted-foreground py-12">
                 <p>Chưa có nội dung. Vui lòng cấu hình trong phần Landing Page.</p>
               </div>
             )}
           </CardContent>
         </Card>
       </div>
     </MainLayout>
   );
 }