/**
 * Credential Manager: Lưu/lấy mật khẩu bảo mật qua trình duyệt
 * Trên iPhone sẽ tự động sử dụng Face ID / Touch ID
 */

const CREDENTIAL_ID = 'vkho-security-password';

export function isCredentialManagerSupported(): boolean {
  return typeof window !== 'undefined' && 
    'credentials' in navigator && 
    typeof PasswordCredential !== 'undefined';
}

export async function saveSecurityCredential(password: string): Promise<boolean> {
  if (!isCredentialManagerSupported()) return false;
  try {
    const cred = new PasswordCredential({
      id: CREDENTIAL_ID,
      password,
      name: 'Mật khẩu bảo mật VKho',
    });
    await navigator.credentials.store(cred);
    return true;
  } catch (e) {
    console.warn('Failed to store credential:', e);
    return false;
  }
}

export async function getSecurityCredential(): Promise<string | null> {
  if (!isCredentialManagerSupported()) return null;
  try {
    const cred = await navigator.credentials.get({
      password: true,
      mediation: 'optional',
    } as any) as PasswordCredential | null;
    if (cred && cred.id === CREDENTIAL_ID && cred.password) {
      return cred.password;
    }
    return null;
  } catch (e) {
    console.warn('Failed to get credential:', e);
    return null;
  }
}

export async function clearSecurityCredential(): Promise<void> {
  if (!isCredentialManagerSupported()) return;
  try {
    if ('preventSilentAccess' in navigator.credentials) {
      await navigator.credentials.preventSilentAccess();
    }
  } catch (e) {
    console.warn('Failed to clear credential:', e);
  }
}
