'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { X } from 'lucide-react';
import ZentraMonogram from '@/components/shared/ZentraMonogram';
import { chatbotReceptionist } from '@/config/chatbot-receptionist';
import styles from './ChatLauncher.module.css';

/** Once per visit: the tab's session, so opening other pages does not greet again. */
const GREETING_STORAGE_KEY = 'zeni-greeting-seen';
const GREETING_DELAY_MS = 2000;
const GREETING_VISIBLE_MS = 15000;
/** While the pointer or keyboard is on the greeting, it waits this long before checking again. */
const GREETING_RECHECK_MS = 3000;

type ChatLauncherProps = {
  buttonRef: RefObject<HTMLButtonElement | null>;
  ready: boolean;
  open: boolean;
  onOpen: () => void;
};

/**
 * A plain deep-green circle with the serif "Z" monogram, and once per visit a short greeting
 * beside it ("Hi, I'm Zeni! Need something? Message us here.") that opens the chat. The greeting
 * never takes focus and is not announced; the button keeps its own accessible name.
 */
export function ChatLauncher({ buttonRef, ready, open, onOpen }: ChatLauncherProps) {
  const [greeting, setGreeting] = useState(false);
  /** The pointer or keyboard is on the greeting, so it stays until they leave. */
  const engaged = useRef(false);

  useEffect(() => {
    if (!ready) return;
    let seen = true;
    try {
      seen = window.sessionStorage.getItem(GREETING_STORAGE_KEY) === '1';
      if (!seen) window.sessionStorage.setItem(GREETING_STORAGE_KEY, '1');
    } catch {
      seen = true;
    }
    if (seen) return;
    const show = window.setTimeout(() => setGreeting(true), GREETING_DELAY_MS);
    return () => window.clearTimeout(show);
  }, [ready]);

  useEffect(() => {
    if (!greeting) return;
    let timer = 0;
    const hideLater = (delay: number) => {
      timer = window.setTimeout(() => {
        if (engaged.current) hideLater(GREETING_RECHECK_MS);
        else setGreeting(false);
      }, delay);
    };
    hideLater(GREETING_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [greeting]);

  const openChat = () => {
    setGreeting(false);
    onOpen();
  };

  return (
    <div className={styles.dock}>
      {greeting && !open && (
        <div
          className={styles.greeting}
          onPointerEnter={() => {
            engaged.current = true;
          }}
          onPointerLeave={() => {
            engaged.current = false;
          }}
          onFocus={() => {
            engaged.current = true;
          }}
          onBlur={() => {
            engaged.current = false;
          }}
        >
          <button type="button" className={styles.greetingMessage} onClick={openChat}>
            <strong>{chatbotReceptionist.greeting.title}</strong>
            <span>{chatbotReceptionist.greeting.message}</span>
          </button>
          <button
            type="button"
            className={styles.greetingClose}
            aria-label={chatbotReceptionist.greeting.close}
            onClick={() => {
              setGreeting(false);
              // The greeting goes away; the keyboard continues from the chat button.
              buttonRef.current?.focus();
            }}
          >
            <X aria-hidden="true" />
          </button>
        </div>
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
        onClick={openChat}
      >
        <ZentraMonogram variant="solid" size="lg" className={styles.mark} />
      </button>
    </div>
  );
}
