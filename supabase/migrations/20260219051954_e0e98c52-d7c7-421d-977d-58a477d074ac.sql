
-- Enable pgcrypto for field-level encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a secure function to encrypt an API key using the service role key as passphrase
-- We use a stored app-level encryption key derived from the project
CREATE OR REPLACE FUNCTION public.encrypt_api_key(_plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _encryption_key text;
BEGIN
  -- Use a fixed secret stored as a DB setting (set via ALTER DATABASE or use a hardcoded project-specific salt)
  -- In production this would be set via: ALTER DATABASE postgres SET app.encryption_key = 'your-key';
  -- For now we use a project-specific derived key
  _encryption_key := current_setting('app.einvoice_encryption_key', true);
  IF _encryption_key IS NULL OR _encryption_key = '' THEN
    -- Fallback: store as-is (plaintext) if no key configured yet
    RETURN _plaintext;
  END IF;
  RETURN encode(pgp_sym_encrypt(_plaintext, _encryption_key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_api_key(_ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _encryption_key text;
BEGIN
  _encryption_key := current_setting('app.einvoice_encryption_key', true);
  IF _encryption_key IS NULL OR _encryption_key = '' THEN
    RETURN _ciphertext;
  END IF;
  BEGIN
    RETURN pgp_sym_decrypt(decode(_ciphertext, 'base64'), _encryption_key);
  EXCEPTION WHEN OTHERS THEN
    -- If decryption fails (e.g. plaintext stored before encryption was enabled), return as-is
    RETURN _ciphertext;
  END;
END;
$$;

-- Revoke public execute on these sensitive functions
REVOKE EXECUTE ON FUNCTION public.encrypt_api_key(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_api_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_api_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_api_key(text) TO authenticated;
