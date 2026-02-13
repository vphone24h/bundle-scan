-- FIX: Remove overly permissive service_role policies on email_queue
-- Service role should only manage via specific functions, not direct table access
DROP POLICY IF EXISTS "email_queue_insert_service_role" ON public.email_queue;
DROP POLICY IF EXISTS "email_queue_update_service_role" ON public.email_queue;
DROP POLICY IF EXISTS "email_queue_delete_service_role" ON public.email_queue;

-- Create a secure RPC function for edge functions to queue emails
CREATE OR REPLACE FUNCTION public.queue_email(
  _tenant_id uuid,
  _recipient_email text,
  _email_type text,
  _subject text,
  _body_html text,
  _body_text text DEFAULT NULL,
  _scheduled_for timestamp with time zone DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email_id uuid;
BEGIN
  INSERT INTO public.email_queue (
    tenant_id, recipient_email, email_type, subject, body_html, body_text, scheduled_for, status
  ) VALUES (
    _tenant_id, _recipient_email, _email_type, _subject, _body_html, _body_text, _scheduled_for, 'pending'
  )
  RETURNING id INTO _email_id;
  
  RETURN _email_id;
END;
$$;

-- Create SELECT policy for platform admins to view email queue (not exposed to regular users)
CREATE POLICY "email_queue_select_platform_admin_only"
  ON public.email_queue
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Deny all other operations on email_queue table (force use of RPC function instead)
CREATE POLICY "email_queue_deny_authenticated"
  ON public.email_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "email_queue_deny_update"
  ON public.email_queue
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "email_queue_deny_delete"
  ON public.email_queue
  FOR DELETE
  TO authenticated
  USING (false);
