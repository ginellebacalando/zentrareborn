'use client';

import { useEffect, useState, type RefObject } from 'react';
import ZentraMonogram from '@/components/shared/ZentraMonogram';
import { chatbotReceptionist } from '@/config/chatbot-receptionist';
import styles from './ChatLauncher.module.css';

const HINT_STORAGE_KEY = 'zeni-launcher-hint-seen';
const HINT_DELAY_MS = 1200;
const HINT_VISIBLE_MS = 8000;

type ChatLauncherProps = {
  buttonRef: RefObject<HTMLButtonElement | null>;
  ready: boolean;
  open: boolean;
  onOpen: () => void;
};

/** Figma launcher: a white circle with a thin deep-green ring and the serif "Z" monogram. */
export function ChatLauncher({ buttonRef, ready, open, onOpen }: ChatLauncherProps) {
  const [hintVisible, setHintVisible] = useState(false);

  // A one-time label on the first visit only; it duplicates the button's accessible name.
  useEffect(() => {
    if (!ready) return;
    let seen = true;
    try {
      seen = window.localStorage.getItem(HINT_STORAGE_KEY) === '1';
      if (!seen) window.localStorage.setItem(HINT_STORAGE_KEY, '1');
    } catch {
      seen = true;
    }
    if (seen) return;
    const show = window.setTimeout(() => setHintVisible(true), HINT_DELAY_MS);
    const hide = window.setTimeout(() => setHintVisible(false), HINT_DELAY_MS + HINT_VISIBLE_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [ready]);

  return (
    <div className={styles.dock}>
      {hintVisible && !open && (
        <p className={styles.hint} aria-hidden="true">
          {chatbotReceptionist.launcherHint}
        </p>
      )}
      <button
        ref={buttonRef}
        type="button"
        className={styles.launcher}
        aria-label={chatbotReceptionist.launcherLabel}
        aria-haspopup="dialog"
        aria-controls="zion-chatbot"
        aria-expanded={open}
        aria-busy={!ready}
        disabled={!ready}
        onClick={onOpen}
      >
        <span className={styles.ring} aria-hidden="true" />
        <ZentraMonogram variant="outline" size="lg" className={styles.mark} />
      </button>
    </div>
  );
}
