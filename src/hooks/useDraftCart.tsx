import { useState, useEffect, useCallback } from 'react';

interface DraftCartData<T> {
  items: T[];
  supplierId?: string;
  branchId?: string;
  savedAt: number;
}

const DRAFT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export function useDraftCart<T>(storageKey: string) {
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftCartData<T> | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftCartData<T>;
      if (
        parsed &&
        Array.isArray(parsed.items) &&
        parsed.items.length > 0 &&
        typeof parsed.savedAt === 'number' &&
        Date.now() - parsed.savedAt <= DRAFT_TTL_MS
      ) {
        setPendingDraft(parsed);
        setShowResumePrompt(true);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const saveDraft = useCallback((items: T[], extra?: { supplierId?: string; branchId?: string }) => {
    if (items.length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    const data: DraftCartData<T> = {
      items,
      supplierId: extra?.supplierId,
      branchId: extra?.branchId,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {}
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setPendingDraft(null);
    setShowResumePrompt(false);
  }, [storageKey]);

  const dismissPrompt = useCallback(() => {
    setShowResumePrompt(false);
    setPendingDraft(null);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const acceptDraft = useCallback(() => {
    setShowResumePrompt(false);
    // pendingDraft remains available for caller to use
  }, []);

  return {
    showResumePrompt,
    pendingDraft,
    saveDraft,
    clearDraft,
    dismissPrompt,
    acceptDraft,
  };
}
