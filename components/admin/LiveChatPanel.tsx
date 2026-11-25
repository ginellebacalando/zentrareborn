'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Headset, RefreshCw, SendHorizontal, Undo2, Volume2, VolumeX, X } from 'lucide-react';
import {
  LIVE_CHAT_RULES,
  type LiveChatStatus,
  type LiveMessage,
  type StaffLiveChat,
  type StaffLiveChatDetail,
  type StaffLiveOverview,
} from '@/lib/chatbot/live-chat';
import { LIVE_CHAT_SOUND_KEY, liveChatSoundOn, playLiveChatChime } from './useLiveChatAlerts';
import styles from './LiveChatPanel.module.css';

const OVERVIEW_MS = 5_000;

const STATUS_LABELS: Record<LiveChatStatus, string> = {
  WAITING: 'Waiting',
  ACTIVE: 'Active',
  RETURNED: 'Back with Zeni',
  CLOSED: 'Closed',
  MISSED: 'Missed',
};

function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

function waitedLabel(iso: string, now: number) {
  const minutes = minutesSince(iso, now);
  return minutes < 1 ? 'just now' : `${minutes} min ago`;
}

function clock(iso: string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Who else can answer, so a staff member knows whether switching off leaves visitors with no one. */
function availabilityLine(overview: StaffLiveOverview | null) {
  if (!overview) return 'Checking who is available…';
  const { available, staffOnline } = overview;
  if (available) {
    const others = staffOnline - 1;
    if (others < 1) return 'You are the only staff member available right now.';
    return `You and ${others} other staff ${others === 1 ? 'member are' : 'members are'} available.`;
  }
  if (staffOnline < 1) return 'Nobody is available right now.';
  return `${staffOnline} staff ${staffOnline === 1 ? 'member is' : 'members are'} available now.`;
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !payload) throw new Error(payload?.error ?? 'Live chat is unavailable.');
  return payload;
}

async function post<T>(body: unknown) {
  return readJson<T>(
    await fetch('/api/admin/live-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Staff side of live chat: switch availability on, see who is waiting, take a chat, reply in
 * the visitor's Zeni window and hand them back to Zeni when everything is settled.
 */
export default function LiveChatPanel({
  staffId,
  staffName,
}: {
  staffId: string;
  staffName: string;
}) {
  const [overview, setOverview] = useState<StaffLiveOverview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chat, setChat] = useState<StaffLiveChat | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [outcome, setOutcome] = useState('');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(true);
  const lastId = useRef<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  /** Where keyboard focus goes once the reply box appears (after taking) or goes (after finishing). */
  const focusNext = useRef<'reply' | 'heading' | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(
        await readJson<StaffLiveOverview>(
          await fetch('/api/admin/live-chat', { cache: 'no-store' }),
        ),
      );
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Live chat is unavailable.');
    }
  }, []);

  const loadChat = useCallback(async (id: string) => {
    const query = new URLSearchParams({ chat: id });
    if (lastId.current) query.set('after', lastId.current);
    const detail = await readJson<StaffLiveChatDetail>(
      await fetch(`/api/admin/live-chat?${query}`, { cache: 'no-store' }),
    );
    setChat(detail.chat);
    if (detail.messages.length) {
      lastId.current = detail.messages[detail.messages.length - 1].id;
      setMessages((current) => [
        ...current,
        ...detail.messages.filter((message) => !current.some((known) => known.id === message.id)),
      ]);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void loadOverview(), 0);
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === 'visible') void loadOverview();
    }, OVERVIEW_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadChat(selectedId).catch(() => {});
    }, LIVE_CHAT_RULES.pollMs);
    return () => window.clearInterval(timer);
  }, [selectedId, loadChat]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages.length]);

  // Reads the saved sound preference once the page is in the browser.
  useEffect(() => {
    const saved = liveChatSoundOn();
    if (!saved) queueMicrotask(() => setSound(false));
  }, []);

  function select(id: string) {
    lastId.current = null;
    setSelectedId(id);
    setChat(null);
    setMessages([]);
    setDraft('');
    setOutcome('');
    setActionError('');
    void loadChat(id).catch((error: unknown) =>
      setActionError(error instanceof Error ? error.message : 'This chat could not be opened.'),
    );
  }

  async function run<T>(work: () => Promise<T>, success?: string) {
    setWorking(true);
    setActionError('');
    try {
      const result = await work();
      if (success) setNotice(success);
      return result;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'That did not work. Try again.');
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function setAvailable(available: boolean) {
    const next = await run(
      () => post<StaffLiveOverview>({ op: 'presence', available }),
      available
        ? 'You are available. Visitors who ask Zeni for a person can now reach you.'
        : 'You are no longer available for live chat.',
    );
    if (next) setOverview(next);
  }

  async function take(id: string) {
    const detail = await run(
      () => post<StaffLiveChatDetail>({ op: 'claim', id }),
      'You joined the chat. The visitor can see your first name.',
    );
    if (detail) {
      focusNext.current = 'reply';
      lastId.current = detail.messages.at(-1)?.id ?? null;
      setChat(detail.chat);
      setMessages(detail.messages);
      void loadOverview();
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    const sent = await run(() =>
      post<{ message: LiveMessage }>({ op: 'send', id: selectedId, text: draft }),
    );
    if (sent) {
      setDraft('');
      lastId.current = sent.message.id;
      setMessages((current) => [...current, sent.message]);
    }
    draftRef.current?.focus();
  }

  async function finish(how: 'return' | 'close') {
    if (!selectedId) return;
    const detail = await run(
      () => post<StaffLiveChatDetail>({ op: how, id: selectedId, outcome }),
      how === 'return' ? 'The visitor is back with Zeni.' : 'The chat is closed.',
    );
    if (detail) {
      focusNext.current = 'heading';
      setChat(detail.chat);
      void loadChat(selectedId).catch(() => {});
      void loadOverview();
    }
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    try {
      window.localStorage.setItem(LIVE_CHAT_SOUND_KEY, next ? 'on' : 'off');
    } catch {
      // The preference simply isn't remembered on this browser.
    }
    if (next) playLiveChatChime();
  }

  const quickReplies = [
    `Hi! I'm ${staffName} from Zion Events Place. How can I help you today?`,
    'Let me check that for you. One moment, please.',
    `You can send your booking request here: ${typeof window === 'undefined' ? '' : window.location.origin}/booking`,
    'Thank you for chatting with us! I will hand you back to Zeni now.',
  ];
  const mine = chat?.status === 'ACTIVE' && chat.staffUserId === staffId;

  // The button that was pressed disappears with the state change, so focus is placed explicitly.
  useEffect(() => {
    if (focusNext.current === 'reply' && mine) draftRef.current?.focus();
    else if (focusNext.current === 'heading' && !mine) detailHeading.current?.focus();
    else return;
    focusNext.current = null;
  }, [mine]);
  const lists: Array<{ title: string; items: StaffLiveChat[]; empty: string }> = overview
    ? [
        { title: 'Waiting', items: overview.waiting, empty: 'No one is waiting.' },
        { title: 'In progress', items: overview.active, empty: 'No active chats.' },
        { title: 'Earlier this week', items: overview.recent, empty: 'No earlier chats.' },
      ]
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeading}>
        <div>
          <h1>Live chat</h1>
          <p>
            When a visitor asks Zeni for a person, the chat waits here. Take it, reply in the
            visitor&apos;s Zeni window, then hand them back to Zeni once everything is settled.
          </p>
        </div>
        <div className={styles.headingActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={toggleSound}
            aria-pressed={sound}
          >
            {sound ? (
              <Volume2 size={16} aria-hidden="true" />
            ) : (
              <VolumeX size={16} aria-hidden="true" />
            )}
            Sound alerts
          </button>
          <button type="button" className={styles.secondary} onClick={() => void loadOverview()}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <section className={styles.presence} aria-labelledby="live-presence-title">
        <h2 id="live-presence-title" className={styles.srOnly}>
          Your availability
        </h2>
        <div className={styles.switchRow}>
          <input
            id="live-chat-available"
            type="checkbox"
            role="switch"
            aria-describedby="live-chat-available-hint"
            checked={Boolean(overview?.available)}
            disabled={!overview || working}
            onChange={(event) => void setAvailable(event.target.checked)}
          />
          <div className={styles.switchText}>
            <label htmlFor="live-chat-available" className={styles.switchLabel}>
              Available for live chat
            </label>
            <p id="live-chat-available-hint" className={styles.hint}>
              {availabilityLine(overview)} Keep any admin page open to stay available; when nobody
              is, Zeni offers to pass the message on by email.
            </p>
          </div>
        </div>
      </section>

      <p className={styles.notice} role="status" aria-live="polite">
        {notice}
      </p>
      {loadError ? (
        <p className={styles.alert} role="alert">
          {loadError}
        </p>
      ) : null}

      <div className={styles.layout}>
        <nav className={styles.lists} aria-label="Live chats">
          {lists.map((list) => (
            <section key={list.title} aria-label={list.title}>
              <h2 className={styles.listTitle}>
                {list.title} <span className={styles.count}>{list.items.length}</span>
              </h2>
              {list.items.length ? (
                <ul className={styles.chatList}>
                  {list.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={styles.chatButton}
                        aria-current={item.id === selectedId ? 'true' : undefined}
                        onClick={() => select(item.id)}
                      >
                        <span className={styles.chatName}>
                          {item.visitorName || 'Website visitor'}
                          <span className={styles.status} data-status={item.status}>
                            {STATUS_LABELS[item.status]}
                          </span>
                        </span>
                        <span className={styles.chatLine}>
                          {item.lastMessage ||
                            item.summary.split('\n')[0] ||
                            'Asked to talk to staff'}
                        </span>
                        <span className={styles.chatMeta}>
                          {item.status === 'WAITING'
                            ? `Waiting since ${waitedLabel(item.createdAt, now)}`
                            : item.staffName
                              ? `${item.staffName} · ${waitedLabel(item.lastMessageAt, now)}`
                              : waitedLabel(item.lastMessageAt, now)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>{list.empty}</p>
              )}
            </section>
          ))}
        </nav>

        <section className={styles.detail} aria-label="Conversation">
          {!selectedId ? (
            <div className={styles.empty}>
              <Headset size={28} aria-hidden="true" />
              <p>Choose a chat to read it. New visitors appear under Waiting.</p>
            </div>
          ) : !chat ? (
            <p className={styles.muted}>Opening the chat…</p>
          ) : (
            <>
              <header className={styles.detailHeader}>
                <div>
                  <h2 ref={detailHeading} tabIndex={-1}>
                    {chat.visitorName || 'Website visitor'}
                  </h2>
                  <p className={styles.muted}>
                    Started {clock(chat.createdAt)}
                    {chat.staffName ? ` · with ${chat.staffName}` : ''}
                  </p>
                </div>
                <span className={styles.status} data-status={chat.status}>
                  {STATUS_LABELS[chat.status]}
                </span>
              </header>

              {chat.summary ? (
                <section className={styles.summary} aria-labelledby="live-chat-summary-title">
                  <h3 id="live-chat-summary-title" className={styles.summaryTitle}>
                    What the visitor told Zeni
                  </h3>
                  <p className={styles.summaryText}>{chat.summary}</p>
                </section>
              ) : null}

              <div
                ref={log}
                className={styles.log}
                role="log"
                aria-live="polite"
                aria-label={`Messages with ${chat.visitorName || 'the visitor'}`}
              >
                {messages.map((message) =>
                  message.sender === 'SYSTEM' ? (
                    <p key={message.id} className={styles.systemNote}>
                      {message.body}
                    </p>
                  ) : (
                    <div key={message.id} className={styles.message} data-sender={message.sender}>
                      <p className={styles.messageAuthor}>
                        {message.sender === 'STAFF'
                          ? `${message.author || 'Staff'} (staff)`
                          : message.author || 'Visitor'}{' '}
                        <span className={styles.muted}>{clock(message.at)}</span>
                      </p>
                      <p className={styles.messageBody}>{message.body}</p>
                    </div>
                  ),
                )}
              </div>

              {actionError ? (
                <p className={styles.alert} role="alert">
                  {actionError}
                </p>
              ) : null}

              {chat.status === 'WAITING' ? (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={working}
                  onClick={() => void take(chat.id)}
                >
                  <Headset size={18} aria-hidden="true" />
                  Take this chat
                </button>
              ) : null}

              {chat.status === 'ACTIVE' && !mine ? (
                <p className={styles.muted}>{chat.staffName} is handling this chat.</p>
              ) : null}

              {mine ? (
                <>
                  <form className={styles.composer} onSubmit={(event) => void send(event)}>
                    <label htmlFor="live-chat-reply" className={styles.label}>
                      Reply to the visitor
                    </label>
                    <div className={styles.composerRow}>
                      <textarea
                        ref={draftRef}
                        id="live-chat-reply"
                        rows={3}
                        maxLength={LIVE_CHAT_RULES.maxMessageLength}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter' &&
                            !event.shiftKey &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                      />
                      <button
                        type="submit"
                        className={styles.primary}
                        disabled={working || !draft.trim()}
                      >
                        <SendHorizontal size={18} aria-hidden="true" />
                        Send
                      </button>
                    </div>
                    <div className={styles.quickReplies} role="group" aria-label="Quick replies">
                      {quickReplies.map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          className={styles.chip}
                          onClick={() => {
                            setDraft(reply);
                            draftRef.current?.focus();
                          }}
                        >
                          {reply.length > 48 ? `${reply.slice(0, 46)}…` : reply}
                        </button>
                      ))}
                    </div>
                  </form>

                  <div className={styles.finish}>
                    <label htmlFor="live-chat-outcome" className={styles.label}>
                      What was agreed? <span className={styles.muted}>(staff only, optional)</span>
                    </label>
                    <input
                      id="live-chat-outcome"
                      className={styles.input}
                      maxLength={1000}
                      value={outcome}
                      onChange={(event) => setOutcome(event.target.value)}
                    />
                    <div className={styles.finishActions}>
                      <button
                        type="button"
                        className={styles.primary}
                        disabled={working}
                        onClick={() => void finish('return')}
                      >
                        <Undo2 size={18} aria-hidden="true" />
                        Return to Zeni
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={working}
                        onClick={() => void finish('close')}
                      >
                        <X size={18} aria-hidden="true" />
                        Close chat
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {chat.outcome && !['WAITING', 'ACTIVE'].includes(chat.status) ? (
                <p className={styles.muted}>Outcome: {chat.outcome}</p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
