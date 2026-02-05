 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { usePlatformUser } from '@/hooks/useTenant';
 import { toast } from 'sonner';
 
 interface TaxPolicyArticle {
   id: string;
   tenant_id: string | null;
   title: string;
   content: string | null;
   is_published: boolean;
   created_at: string;
   updated_at: string;
 }
 
 export function useTaxPolicyArticle() {
   const { data: platformUser } = usePlatformUser();
   const tenantId = platformUser?.tenant_id;
 
   return useQuery({
     queryKey: ['tax-policy-article', tenantId],
     queryFn: async () => {
       if (!tenantId) return null;
       
       const { data, error } = await supabase
         .from('tax_policy_articles')
         .select('*')
         .eq('tenant_id', tenantId)
         .maybeSingle();
       
       if (error) throw error;
       return data as TaxPolicyArticle | null;
     },
     enabled: !!tenantId,
   });
 }
 
 export function useUpdateTaxPolicyArticle() {
   const queryClient = useQueryClient();
   const { data: platformUser } = usePlatformUser();
   const tenantId = platformUser?.tenant_id;
 
   return useMutation({
     mutationFn: async ({ title, content }: { title: string; content: string }) => {
       if (!tenantId) throw new Error('Không tìm thấy tenant');
 
       // Check if article exists
       const { data: existing } = await supabase
         .from('tax_policy_articles')
         .select('id')
         .eq('tenant_id', tenantId)
         .maybeSingle();
 
       if (existing) {
         // Update existing
         const { error } = await supabase
           .from('tax_policy_articles')
           .update({ title, content, is_published: true })
           .eq('id', existing.id);
         if (error) throw error;
       } else {
         // Create new
         const { error } = await supabase
           .from('tax_policy_articles')
           .insert({ tenant_id: tenantId, title, content, is_published: true });
         if (error) throw error;
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['tax-policy-article'] });
       toast.success('Đã lưu bài viết thành công');
     },
     onError: (error) => {
       toast.error('Lỗi khi lưu: ' + error.message);
     },
   });
 }