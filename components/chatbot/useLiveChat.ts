'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LIVE_CHAT_RULES,
  isOpenLiveChat,
  type LiveMessage,
  type VisitorLiveChat,
} from '@/lib/chatbot/live-chat';
import { nextMessageOrder } from './messageOrder';

type LiveStatus = Omit<VisitorLiveChat, 'messages'>;
/** A staff chat message plus its place in the Zeni window's timeline. */
export type OrderedLiveMessage = LiveMessage & { order: number };

/**
 * The visitor's side of a staff live chat. It asks for new messages every few seconds while the
 * chat window is open and the chat is waiting for or talking with staff, and stops afterwards.
 */
export function useLiveChat(open: boolean) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [messages, setMessages] = useState<OrderedLiveMessage[]>([]);
  const [sending, setSending] = useState(false);
  const lastId = useRef<string | null>(null);
  const active = status ? isOpenLiveChat(status.status) : false;

  const refresh = useCallback(async () => {
    const query = lastId.current ? `?after=${encodeURIComponent(lastId.current)}` : '';
    const response = await fetch(`/api/client/chatbot/live${query}`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as { chat?: VisitorLiveChat | null };
    if (!payload.chat) return;
    const { messages: fresh, ...next } = payload.chat;
    setStatus(next);
    if (fresh.length) {
      lastId.current = fresh[fresh.length - 1].id;
      const arrived = fresh.map((message) => ({ ...message, order: nextMessageOrder() }));
      setMessages((current) => [
        ...current,
        ...arrived.filter((message) => !current.some((known) => known.id === message.id)),
      ]);
    }
  }, []);

  useEffect(() => {
    if (!open || !active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh().catch(() => {});
    }, LIVE_CHAT_RULES.pollMs);
    return () => window.clearInterval(timer);
  }, [open, active, refresh]);

  /** Zeni just put the visitor in the queue. */
  const start = useCallback(() => {
    setStatus({ status: 'WAITING', staffName: null, position: 1 });
    void refresh().catch(() => {});
  }, [refresh]);

  /** Returns false when the message did not send, so the caller keeps the typed text. */
  const send = useCallback(async (text: string) => {
    setSending(true);
    try {
      const response = await fetch('/api/client/chatbot/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: LiveMessage;
        error?: string;
      } | null;
      if (!response.ok || !payload?.message) return payload?.error ?? false;
      const message = { ...payload.message, order: nextMessageOrder() };
      lastId.current = message.id;
      setMessages((current) =>
        current.some((known) => known.id === message.id) ? current : [...current, message],
      );
      return true;
    } catch {
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  const end = useCallback(async () => {
    await fetch('/api/client/chatbot/live', { method: 'DELETE', cache: 'no-store' }).catch(
      () => {},
    );
    await refresh().catch(() => {});
  }, [refresh]);

  /** A new Zeni conversation starts without the old staff chat on screen. */
  const forget = useCallback(() => {
    lastId.current = null;
    setStatus(null);
    setMessages([]);
  }, []);

  return { status, messages, active, sending, refresh, start, send, end, forget };
}
