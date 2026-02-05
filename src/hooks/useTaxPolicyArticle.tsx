 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
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
 
 // Hook for tenants to read the global platform article
 export function useTaxPolicyArticle() {
   return useQuery({
     queryKey: ['tax-policy-article-global'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('tax_policy_articles')
         .select('*')
         .is('tenant_id', null)
         .maybeSingle();
       
       if (error) throw error;
       return data as TaxPolicyArticle | null;
     },
   });
 }
 
 // Hook for platform admin to update global article
 export function useUpdateTaxPolicyArticle() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ title, content }: { title: string; content: string }) => {
       // Check if global article exists
       const { data: existing } = await supabase
         .from('tax_policy_articles')
         .select('id')
         .is('tenant_id', null)
         .maybeSingle();
 
       if (existing) {
         // Update existing
         const { error } = await supabase
           .from('tax_policy_articles')
           .update({ title, content, is_published: true })
           .eq('id', existing.id);
         if (error) throw error;
       } else {
         // Create new global article (tenant_id = null)
         const { error } = await supabase
           .from('tax_policy_articles')
           .insert({ tenant_id: null, title, content, is_published: true });
         if (error) throw error;
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['tax-policy-article-global'] });
       toast.success('Đã lưu bài viết thành công');
     },
     onError: (error) => {
       toast.error('Lỗi khi lưu: ' + error.message);
     },
   });
 }