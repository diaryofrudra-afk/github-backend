import { useEffect, useRef, useState } from 'react';

const KEY_PREFIX = 'suprwise_draft_';

export function draftKey(kind: 'invoice' | 'quotation', id: string | undefined) {
  return `${KEY_PREFIX}${kind}_${id || 'new'}`;
}

export function readDraft<T>(kind: 'invoice' | 'quotation', id: string | undefined): T | null {
  try {
    const raw = localStorage.getItem(draftKey(kind, id));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearDraft(kind: 'invoice' | 'quotation', id: string | undefined) {
  try {
    localStorage.removeItem(draftKey(kind, id));
  } catch {
    // ignore
  }
}

export function useDocumentDraft<T>(
  kind: 'invoice' | 'quotation',
  id: string | undefined,
  payload: T,
  enabled: boolean,
  delay = 500
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(kind, id), JSON.stringify(payload));
      } catch {
        // quota / unavailable — ignore
      }
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [kind, id, payload, enabled, delay]);
}

export function useDraftRestorePrompt(
  kind: 'invoice' | 'quotation',
  id: string | undefined
): { hasDraft: boolean; consume: () => void; dismiss: () => void } {
  const [hasDraft, setHasDraft] = useState(() => !!readDraft(kind, id));
  return {
    hasDraft,
    consume: () => setHasDraft(false),
    dismiss: () => {
      clearDraft(kind, id);
      setHasDraft(false);
    },
  };
}
