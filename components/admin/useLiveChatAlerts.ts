'use client';

import { useEffect, useRef, useState } from 'react';

const CHECK_MS = 15_000;
export const LIVE_CHAT_SOUND_KEY = 'zion-live-chat-sound';

/** Whether staff turned the live chat sound off on this computer (on by default). */
export function liveChatSoundOn() {
  try {
    return window.localStorage.getItem(LIVE_CHAT_SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** A short, soft two-note chime made in the browser; no audio file is downloaded. */
export function playLiveChatChime() {
  if (!liveChatSoundOn()) return;
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.18;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.32);
    });
    window.setTimeout(() => void context.close(), 1000);
  } catch {
    // Sound is a courtesy; the badge and the page title still show the waiting chat.
  }
}

/**
 * Checks every 15 seconds, on every admin page, how many visitors wait in live chat. It also keeps
 * an available staff member counted as online. A new waiting chat plays a chime, announces itself
 * politely to screen readers and adds the count to the browser tab title.
 */
export function useLiveChatAlerts(enabled: boolean) {
  const [waiting, setWaiting] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const previous = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch('/api/admin/live-chat?view=count', { cache: 'no-store' });
        if (!response.ok || stopped) return;
        const { waiting: count } = (await response.json()) as { waiting?: number };
        if (stopped || typeof count !== 'number') return;
        if (count > previous.current) {
          playLiveChatChime();
          setAnnouncement(
            count === 1
              ? 'A visitor is waiting in live chat.'
              : `${count} visitors are waiting in live chat.`,
          );
        }
        previous.current = count;
        setWaiting(count);
      } catch {
        // Offline or signed out: the next check tries again.
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), CHECK_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = waiting > 0 ? `(${waiting}) ${base}` : base;
  }, [waiting]);

  return { waiting, announcement };
}
