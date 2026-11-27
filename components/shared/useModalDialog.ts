'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { containDialogFocus } from '@/lib/dialog-focus';

/**
 * A native modal dialog's keyboard and backdrop behavior: Tab and Shift+Tab stay inside, a click
 * on the backdrop closes it, and `onKey` sees other keys (arrows in a photo viewer). The listeners
 * are attached to the dialog element itself, which is not an interactive React target; Escape and
 * focus return are the browser's own.
 */
export function useModalDialog(
  ref: RefObject<HTMLDialogElement | null>,
  onKey?: (event: KeyboardEvent) => void,
) {
  const keyHandler = useRef(onKey);
  useEffect(() => {
    keyHandler.current = onKey;
  }, [onKey]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const keydown = (event: KeyboardEvent) => {
      keyHandler.current?.(event);
      containDialogFocus(event);
    };
    const click = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.addEventListener('keydown', keydown);
    dialog.addEventListener('click', click);
    return () => {
      dialog.removeEventListener('keydown', keydown);
      dialog.removeEventListener('click', click);
    };
  }, [ref]);
}
