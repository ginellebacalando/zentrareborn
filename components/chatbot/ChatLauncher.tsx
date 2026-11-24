'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { chatbotReceptionist } from '@/config/chatbot-receptionist';
import styles from './ChatLauncher.module.css';

const GREETING_INTERVAL_MS = 6_000;
type ChatLauncherProps = {
  buttonRef: RefObject<HTMLButtonElement | null>;
  ready: boolean;
  open: boolean;
  onOpen: () => void;
};

export function ChatLauncher({ buttonRef, ready, open, onOpen }: ChatLauncherProps) {
  const reducedMotion = useReducedMotion();
  const [greetingsEnabled, setGreetingsEnabled] = useState(true);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [animationUnavailable, setAnimationUnavailable] = useState(false);
  const dismissButton = useRef<HTMLButtonElement>(null);
  const engaged = hovered || focused;
  const allowMotion = ready && documentVisible && !reducedMotion && !open;
  const greetingRotationEnabled = allowMotion && greetingsEnabled;
  const waveMotionEnabled = allowMotion && engaged;

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (!allowMotion || animationUnavailable) return;
    const preload = new window.Image();
    preload.src = chatbotReceptionist.waveAvatar.src;
  }, [allowMotion, animationUnavailable]);

  useEffect(() => {
    if (!greetingRotationEnabled || engaged) return;
    const timer = window.setInterval(() => {
      setGreetingIndex((index) => (index + 1) % chatbotReceptionist.launcherGreetings.length);
    }, GREETING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [greetingRotationEnabled, engaged]);

  const avatar = animationUnavailable
    ? chatbotReceptionist.avatar
    : waveMotionEnabled
      ? chatbotReceptionist.waveAvatar
      : allowMotion
        ? chatbotReceptionist.animatedAvatar
        : chatbotReceptionist.avatar;
  const mascotClassName = [
    styles.mascot,
    waveMotionEnabled ? styles.mascotWave : allowMotion ? styles.mascotIdle : '',
  ]
    .filter(Boolean)
    .join(' ');
  const greeting = reducedMotion
    ? chatbotReceptionist.reducedMotionGreeting
    : chatbotReceptionist.launcherGreetings[greetingIndex];

  return (
    <div
      className={styles.dock}
      hidden={open}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {ready && greetingsEnabled && (
        <div className={styles.greeting} aria-live="off">
          <p className={styles.greetingText} key={reducedMotion ? 'static' : greetingIndex}>
            {greeting}
          </p>
          <button
            ref={dismissButton}
            type="button"
            className={styles.dismiss}
            aria-label="Dismiss greeting"
            title="Dismiss greeting"
            onClick={() => {
              setGreetingsEnabled(false);
              buttonRef.current?.focus({ preventScroll: true });
            }}
          >
            <span className={styles.dismissCircle} aria-hidden="true">
              <X size={14} strokeWidth={2.5} />
            </span>
          </button>
        </div>
      )}
      <div className={styles.character}>
        <button
          ref={buttonRef}
          type="button"
          className={styles.launcher}
          aria-label="Open chat with Zeni, Zion’s virtual receptionist"
          aria-haspopup="dialog"
          aria-controls="zion-chatbot"
          aria-expanded={open}
          aria-busy={!ready}
          disabled={!ready}
          onClick={onOpen}
        >
          <Image
            {...avatar}
            alt=""
            unoptimized
            sizes="(max-width: 36rem) 44px, 80px"
            className={mascotClassName}
            onError={() => setAnimationUnavailable(true)}
          />
        </button>
      </div>
    </div>
  );
}
