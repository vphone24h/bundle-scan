-- Fix UPDATE policy: add WITH CHECK clause
DROP POLICY IF EXISTS "Platform admins can update notifications" ON public.system_notifications;

CREATE POLICY "Platform admins can update notifications"
ON public.system_notifications
FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));