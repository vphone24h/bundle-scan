/**
 * Biometric/Face ID support via iCloud Keychain + autofill
 * Safari không hỗ trợ PasswordCredential API,
 * nên ta dùng hidden form + autocomplete để trigger Face ID autofill
 */

// Safari supports credential autofill with Face ID via autocomplete attributes
// We detect iOS/Safari to show the Face ID button
export function isBiometricLikelySupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iOS devices (iPhone/iPad) with Safari or PWA
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Android with Chrome also supports biometric autofill
  const isAndroid = /Android/.test(ua);
  return isIOS || isAndroid;
}

// Store password in localStorage (encrypted-like, base64)
// This is a fallback since Safari doesn't support PasswordCredential
const STORAGE_KEY = 'vkho_sp_saved';

export function saveSecurityPassword(password: string): void {
  try {
    const encoded = btoa(encodeURIComponent(password));
    localStorage.setItem(STORAGE_KEY, encoded);
  } catch (e) {
    console.warn('Failed to save security password:', e);
  }
}

export function getSavedSecurityPassword(): string | null {
  try {
    const encoded = localStorage.getItem(STORAGE_KEY);
    if (!encoded) return null;
    return decodeURIComponent(atob(encoded));
  } catch (e) {
    console.warn('Failed to get saved security password:', e);
    return null;
  }
}

export function clearSavedSecurityPassword(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasSavedSecurityPassword(): boolean {
  return !!localStorage.getItem(STORAGE_KEY);
}
