'use client';

import { type Dispatch, type SetStateAction, useEffect } from 'react';

export const FIELD_ERROR_VISIBLE_DURATION_MS = 5000;

export function useAutoDismissFieldErrors<T extends object>(
  fieldErrors: T,
  setFieldErrors: Dispatch<SetStateAction<T>>,
  durationMs = FIELD_ERROR_VISIBLE_DURATION_MS,
) {
  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);

  useEffect(() => {
    if (!hasFieldErrors) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFieldErrors({} as T);
    }, durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [durationMs, fieldErrors, hasFieldErrors, setFieldErrors]);
}
