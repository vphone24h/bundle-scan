import { useState, useEffect, useCallback, useRef } from 'react';

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
  // Block auto-save until user has decided (accept or dismiss)
  const promptDecidedRef = useRef(false);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        promptDecidedRef.current = true; // No draft → allow saving immediately
        return;
      }
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
        promptDecidedRef.current = true;
      }
    } catch {
      localStorage.removeItem(storageKey);
      promptDecidedRef.current = true;
    }
  }, [storageKey]);

  const saveDraft = useCallback((items: T[], extra?: { supplierId?: string; branchId?: string }) => {
    // Don't save while prompt is still showing (would overwrite draft with empty cart)
    if (!promptDecidedRef.current) return;

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
    promptDecidedRef.current = true;
    localStorage.removeItem(storageKey);
    setPendingDraft(null);
    setShowResumePrompt(false);
  }, [storageKey]);

  const dismissPrompt = useCallback(() => {
    promptDecidedRef.current = true;
    setShowResumePrompt(false);
    setPendingDraft(null);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const acceptDraft = useCallback(() => {
    promptDecidedRef.current = true;
    setShowResumePrompt(false);
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
