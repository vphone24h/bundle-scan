-- Cho phép admin (super_admin / branch_admin) upload, đọc và xoá file trong bucket 'temp-imports'
-- Chỉ giới hạn trong thư mục thuộc tenant của họ (folder đầu tiên = tenant_id).

-- Helper: kiểm tra user có phải admin của tenant_id không
CREATE OR REPLACE FUNCTION public.is_admin_of_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id
    WHERE pu.user_id = _user_id
      AND pu.tenant_id = _tenant_id
      AND ur.user_role IN ('super_admin', 'branch_admin')
  );
$$;

-- INSERT
DROP POLICY IF EXISTS "Admin can upload temp-imports for own tenant" ON storage.objects;
CREATE POLICY "Admin can upload temp-imports for own tenant"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'temp-imports'
  AND public.is_admin_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- SELECT
DROP POLICY IF EXISTS "Admin can read temp-imports for own tenant" ON storage.objects;
CREATE POLICY "Admin can read temp-imports for own tenant"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'temp-imports'
  AND public.is_admin_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- UPDATE (cho upsert)
DROP POLICY IF EXISTS "Admin can update temp-imports for own tenant" ON storage.objects;
CREATE POLICY "Admin can update temp-imports for own tenant"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'temp-imports'
  AND public.is_admin_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'temp-imports'
  AND public.is_admin_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- DELETE
DROP POLICY IF EXISTS "Admin can delete temp-imports for own tenant" ON storage.objects;
CREATE POLICY "Admin can delete temp-imports for own tenant"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'temp-imports'
  AND public.is_admin_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);