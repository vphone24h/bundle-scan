-- Drop existing policies
DROP POLICY IF EXISTS "Platform admins can manage plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can view active plans" ON public.subscription_plans;

-- Create proper policies with WITH CHECK for INSERT/UPDATE
CREATE POLICY "Authenticated users can view active plans" 
ON public.subscription_plans 
FOR SELECT 
USING (is_authenticated() AND is_active = true);

CREATE POLICY "Platform admins can view all plans" 
ON public.subscription_plans 
FOR SELECT 
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert plans" 
ON public.subscription_plans 
FOR INSERT 
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update plans" 
ON public.subscription_plans 
FOR UPDATE 
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete plans" 
ON public.subscription_plans 
FOR DELETE 
USING (is_platform_admin(auth.uid()));