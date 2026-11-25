'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Info, RotateCcw, SendHorizontal, X } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { chatbotReceptionist, zeniCopyFor } from '@/config/chatbot-receptionist';
import { detectLanguage, type ZeniLanguage } from '@/lib/chatbot/language';
import { containDialogFocus } from '@/lib/dialog-focus';
import type { ChatReply, ConversationSummary, ReceptionistAction } from '@/lib/chatbot/types';
import { ChatAvatar } from './ChatAvatar';
import { ChatLauncher } from './ChatLauncher';
import {
  GuestMessage,
  LiveNote,
  StaffMessage,
  TypingMessage,
  ZeniBubble,
  ZeniMessage,
} from './ChatMessage';
import { ZeniInfo } from './ZeniInfo';
import { OPEN_CHATBOT_EVENT, type OpenChatbotDetail } from './OpenChatbotButton';
import { nextMessageOrder } from './messageOrder';
import { useLiveChat, type OrderedLiveMessage } from './useLiveChat';
import styles from './Chatbot.module.css';

type Exchange = { id: string; question: string; reply: ChatReply; order: number };
/** Zeni's exchanges and staff chat messages, shown as one timeline in arrival order. */
type TimelineItem =
  | { kind: 'zeni'; order: number; exchange: Exchange }
  | { kind: 'live'; order: number; message: OrderedLiveMessage };
type Command = Pick<ReceptionistAction, 'type' | 'value'>;
type Recovery = { question: string; turnId: string; action?: Command };

const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const MAX_LENGTH = 600;
const REQUEST_TIMEOUT_MS = 25000;
const INFO_ID = 'zion-chatbot-info';

function isReply(value: unknown): value is ChatReply {
  if (!value || typeof value !== 'object') return false;
  const reply = value as Partial<ChatReply>;
  return (
    typeof reply.message === 'string' &&
    Array.isArray(reply.sources) &&
    Array.isArray(reply.suggestions)
  );
}

export default function Chatbot() {
  // A server-rendered launcher must not accept clicks before its dialog handlers hydrate.
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const [open, setOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [error, setError] = useState('');
  const [context, setContext] = useState<ConversationSummary | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const restored = useRef(false);
  const retryTurn = useRef<(Recovery & { fingerprint: string }) | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const infoButton = useRef<HTMLButtonElement>(null);
  const infoHeading = useRef<HTMLHeadingElement>(null);
  const infoWasOpen = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const queuedPrompt = useRef<string | null>(null);
  const sendRef = useRef<((value: string, action?: ReceptionistAction) => Promise<void>) | null>(
    null,
  );
  const live = useLiveChat(open);
  const liveRef = useRef(live);

  const language: ZeniLanguage = history.at(-1)?.reply.language ?? context?.language ?? 'en';
  const copy = zeniCopyFor(language);
  const busy = Boolean(pendingQuestion) || restoring || resetting;
  const liveStatus = live.status?.status;

  function closeChat() {
    setInfoOpen(false);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const trigger = launcher.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (element && !element.open) element.showModal();
    const handleKeyDown = (event: KeyboardEvent) => {
      // The heading receives focus on open but stays outside the sequential Tab order.
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === title.current) {
        event.preventDefault();
        (sendButton.current?.disabled ? input.current : sendButton.current)?.focus();
        return;
      }
      containDialogFocus(event);
    };
    let pointerStartedOutside = false;
    const outsidePanel = (event: MouseEvent) => {
      if (!element) return false;
      const bounds = element.getBoundingClientRect();
      return (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      );
    };
    const handlePointerDown = (event: PointerEvent) => {
      pointerStartedOutside = event.target === element && outsidePanel(event);
    };
    const resetPointer = () => {
      pointerStartedOutside = false;
    };
    const handleBackdropClick = (event: MouseEvent) => {
      const dismiss = pointerStartedOutside && event.target === element && outsidePanel(event);
      resetPointer();
      if (dismiss) {
        setInfoOpen(false);
        setOpen(false);
      }
    };
    element?.addEventListener('keydown', handleKeyDown);
    element?.addEventListener('pointerdown', handlePointerDown);
    element?.addEventListener('pointercancel', resetPointer);
    element?.addEventListener('click', handleBackdropClick);
    // Start at the header rather than scrolling small screens to the keyboard.
    title.current?.focus({ preventScroll: true });
    return () => {
      element?.removeEventListener('keydown', handleKeyDown);
      element?.removeEventListener('pointerdown', handlePointerDown);
      element?.removeEventListener('pointercancel', resetPointer);
      element?.removeEventListener('click', handleBackdropClick);
      element?.close();
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  // Opening "How Zeni works" moves focus to its heading; closing returns it to the (i) button.
  useEffect(() => {
    if (infoOpen) infoHeading.current?.focus({ preventScroll: true });
    else if (infoWasOpen.current) infoButton.current?.focus({ preventScroll: true });
    infoWasOpen.current = infoOpen;
  }, [infoOpen]);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const element = conversation.current;
    if (open && !infoOpen && element)
      element.scrollTop =
        history.length || live.messages.length || pendingQuestion ? element.scrollHeight : 0;
  }, [history, pendingQuestion, open, infoOpen, restoring, resetting, live.messages.length]);

  async function restoreConversation(showMessage = false) {
    const response = await fetch('/api/client/chatbot', { cache: 'no-store' });
    const payload = (await response.json()) as {
      reply?: ChatReply | null;
      error?: string;
      retry?: Recovery;
    };
    if (!response.ok) throw new Error(payload.error || copy.errors.restore);
    setContext(payload.reply?.context ?? null);
    setRecovery(payload.retry ?? null);
    if (showMessage && payload.reply && isReply(payload.reply))
      setHistory([
        { id: crypto.randomUUID(), question: '', reply: payload.reply, order: nextMessageOrder() },
      ]);
    restored.current = true;
  }

  function openConversation() {
    setOpen(true);
    // Picks up a staff chat that is open or just finished, after Zeni's welcome-back message so
    // the window reads in order.
    const refreshLive = () => void live.refresh().catch(() => {});
    if (restored.current) {
      refreshLive();
      return;
    }
    setRestoring(true);
    void restoreConversation(true)
      .catch((failure: unknown) =>
        setError(failure instanceof Error ? failure.message : copy.errors.restore),
      )
      .finally(() => {
        setRestoring(false);
        refreshLive();
      });
  }

  async function sendQuestion(
    value: string,
    selectedAction?: ReceptionistAction,
    recoveryTurnId?: string,
  ) {
    const submitted = value.trim();
    if (activeRequest.current || restoring || resetting) return;
    const messages = zeniCopyFor(selectedAction ? language : detectLanguage(submitted, language));
    if (!submitted || submitted.length > MAX_LENGTH) {
      setError(messages.errors.length);
      input.current?.focus();
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    setQuestion(selectedAction ? question : submitted);
    setPendingQuestion(submitted);
    setError('');
    // Retrying a failed action from the retained composer must preserve its command.
    const commandAction: Command | undefined = selectedAction
      ? {
          type: selectedAction.type,
          ...(selectedAction.value ? { value: selectedAction.value } : {}),
        }
      : retryTurn.current?.question === submitted
        ? retryTurn.current.action
        : undefined;
    const fingerprint = JSON.stringify({ question: submitted, action: commandAction });
    if (retryTurn.current?.fingerprint !== fingerprint || recoveryTurnId)
      retryTurn.current = {
        fingerprint,
        turnId: recoveryTurnId ?? crypto.randomUUID(),
        question: submitted,
        action: commandAction,
      };
    const turnId = retryTurn.current.turnId;
    if (selectedAction) input.current?.focus({ preventScroll: true });
    const timeout = window.setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch('/api/client/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          question: submitted,
          turnId,
          expectedRevision: context?.revision,
          action: commandAction,
        }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (response.status === 409) await restoreConversation();
      if (!response.ok)
        throw new Error(
          payload &&
            typeof payload === 'object' &&
            'error' in payload &&
            typeof payload.error === 'string'
            ? payload.error
            : messages.errors.unavailable,
        );
      if (!isReply(payload)) throw new Error(messages.errors.incomplete);
      const exchange: Exchange = {
        id: crypto.randomUUID(),
        question: submitted,
        reply: payload,
        order: nextMessageOrder(),
      };
      setHistory((previous) => [...previous.slice(-19), exchange]);
      setContext(payload.context ?? null);
      retryTurn.current = null;
      setRecovery(null);
      if (!selectedAction) setQuestion('');
      // Zeni handed the visitor to the staff queue: the window switches to the live chat.
      if (payload.live?.status === 'WAITING') live.start();
    } catch (failure) {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') {
        setError(
          controller.signal.reason === 'timeout'
            ? messages.errors.timeout
            : failure instanceof TypeError
              ? messages.errors.network
              : failure instanceof Error
                ? failure.message
                : messages.errors.unavailable,
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPendingQuestion('');
      }
    }
  }

  async function clearConversation() {
    if (activeRequest.current || restoring || resetting) return;
    setResetting(true);
    try {
      // A staff chat ends with its conversation, so staff never wait on a visitor who left.
      if (live.active) await live.end();
      const response = await fetch('/api/client/chatbot', { method: 'DELETE', cache: 'no-store' });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || copy.errors.clear);
      live.forget();
      setHistory([]);
      setQuestion('');
      setError('');
      setContext(null);
      setRecovery(null);
      setInfoOpen(false);
      retryTurn.current = null;
      restored.current = true;
      title.current?.focus({ preventScroll: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : copy.errors.clear);
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    sendRef.current = sendQuestion;
    liveRef.current = live;
  });

  async function sendLiveMessage() {
    const text = question.trim();
    if (!text || live.sending) return;
    if (text.length > MAX_LENGTH) {
      setError(copy.errors.length);
      return;
    }
    setError('');
    const result = await live.send(text);
    if (result === true) setQuestion('');
    else setError(typeof result === 'string' ? result : copy.live.sendFailed);
    input.current?.focus({ preventScroll: true });
  }

  // Other pages can open Zeni with a prompt, for example "Ask about this space".
  useEffect(() => {
    const handleOpenRequest = (event: Event) => {
      const detail = (event as CustomEvent<OpenChatbotDetail>).detail ?? { reset: true };
      const prompt = detail.prompt?.trim() || '';
      setOpen(true);
      setInfoOpen(false);
      if (detail.reset === false) {
        if (prompt) void sendRef.current?.(prompt);
        return;
      }
      activeRequest.current?.abort();
      activeRequest.current = null;
      setPendingQuestion('');
      setRestoring(false);
      setResetting(true);
      setHistory([]);
      setQuestion('');
      setError('');
      setContext(null);
      setRecovery(null);
      retryTurn.current = null;
      restored.current = true;
      queuedPrompt.current = prompt || null;
      if (liveRef.current.active)
        void fetch('/api/client/chatbot/live', { method: 'DELETE', cache: 'no-store' });
      liveRef.current.forget();
      void fetch('/api/client/chatbot', { method: 'DELETE', cache: 'no-store' })
        .catch(() => {
          // Continue with a fresh local conversation even if the server had none.
        })
        .finally(() => setResetting(false));
    };
    window.addEventListener(OPEN_CHATBOT_EVENT, handleOpenRequest);
    return () => window.removeEventListener(OPEN_CHATBOT_EVENT, handleOpenRequest);
  }, []);

  useEffect(() => {
    if (!open || resetting || restoring || activeRequest.current) return;
    const prompt = queuedPrompt.current;
    if (!prompt) return;
    queuedPrompt.current = null;
    void sendRef.current?.(prompt);
  }, [open, resetting, restoring]);

  const latest = history.at(-1);
  const suggestions = latest?.reply.suggestions.length
    ? latest.reply.suggestions
    : copy.suggestions.welcome;
  const blocked = busy || Boolean(recovery);
  const timeline: TimelineItem[] = [
    ...history.map((exchange) => ({ kind: 'zeni' as const, order: exchange.order, exchange })),
    ...live.messages.map((message) => ({ kind: 'live' as const, order: message.order, message })),
  ].sort((a, b) => a.order - b.order);
  // "Leave a message" belongs right after a missed chat, not under later answers from Zeni.
  const offerMessageAfterMiss =
    liveStatus === 'MISSED' && timeline.at(-1)?.kind === 'live' && !pendingQuestion;

  return (
    <>
      <ChatLauncher buttonRef={launcher} ready={ready} open={open} onOpen={openConversation} />
      <dialog
        ref={dialog}
        id="zion-chatbot"
        className={styles.dialog}
        aria-labelledby="zion-chatbot-title"
        aria-describedby="zion-chatbot-subtitle"
        onCancel={(event) => {
          event.preventDefault();
          if (infoOpen) setInfoOpen(false);
          else closeChat();
        }}
        // Browsers may close a modal without a cancel event (for example repeated Escape);
        // keep React state in step so the launcher can open it again.
        onClose={closeChat}
      >
        <header className={styles.header}>
          <ChatAvatar />
          {/* Plain header: "Zeni" in normal case (screen readers may spell out an all-caps
              title letter by letter) with the venue name under it. */}
          <div className={styles.identity}>
            <h2 ref={title} id="zion-chatbot-title" className={styles.title} tabIndex={-1}>
              {chatbotReceptionist.name}
            </h2>
            <p id="zion-chatbot-subtitle" className={styles.subtitle}>
              {BRAND.legalName}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              ref={infoButton}
              type="button"
              className={styles.iconButton}
              aria-label={chatbotReceptionist.howItWorks}
              title={chatbotReceptionist.howItWorks}
              aria-expanded={infoOpen}
              aria-controls={INFO_ID}
              onClick={() => setInfoOpen((value) => !value)}
            >
              <Info size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={chatbotReceptionist.newConversation}
              title={chatbotReceptionist.newConversation}
              disabled={busy}
              onClick={() => void clearConversation()}
            >
              <RotateCcw size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={chatbotReceptionist.close}
              title={chatbotReceptionist.close}
              onClick={closeChat}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        {live.active && live.status && !infoOpen && (
          <div className={styles.liveBanner}>
            <p className={styles.liveBannerText} role="status">
              {live.status.status === 'ACTIVE' && live.status.staffName
                ? copy.live.activeBanner(live.status.staffName)
                : copy.live.waitingBanner(live.status.position)}
            </p>
            <button
              type="button"
              className={styles.liveEnd}
              // The banner disappears with the chat, so focus moves on to the message field.
              onClick={() =>
                void live.end().finally(() => input.current?.focus({ preventScroll: true }))
              }
            >
              {copy.live.endChat}
            </button>
          </div>
        )}

        {infoOpen && (
          <div className={styles.infoScroller}>
            <ZeniInfo
              id={INFO_ID}
              context={context}
              headingRef={infoHeading}
              onBack={() => setInfoOpen(false)}
            />
          </div>
        )}

        <div
          ref={conversation}
          className={styles.conversation}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation with Zeni"
          hidden={infoOpen}
        >
          {restoring && <TypingMessage label={chatbotReceptionist.opening} />}

          {!restoring && history.length === 0 && (
            <ZeniBubble>
              <div className={styles.zeniBubble}>
                <p className={styles.messageText}>{copy.welcome}</p>
              </div>
            </ZeniBubble>
          )}

          {recovery && (
            <div className={styles.recovery} role="group" aria-label={chatbotReceptionist.retry}>
              <p className={styles.recoveryTitle}>{chatbotReceptionist.interruptedTitle}</p>
              <p className={styles.recoveryHelp}>{chatbotReceptionist.interruptedHelp}</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryAction}
                  disabled={busy}
                  onClick={() =>
                    void sendQuestion(
                      recovery.question,
                      recovery.action
                        ? { ...recovery.action, label: recovery.question }
                        : undefined,
                      recovery.turnId,
                    )
                  }
                >
                  {chatbotReceptionist.retry}
                </button>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  disabled={busy}
                  onClick={() => void clearConversation()}
                >
                  {chatbotReceptionist.newConversation}
                </button>
              </div>
            </div>
          )}

          {timeline.map((item) =>
            item.kind === 'zeni' ? (
              <div key={item.exchange.id} className={styles.exchange}>
                {item.exchange.question && <GuestMessage message={item.exchange.question} />}
                <ZeniMessage
                  reply={item.exchange.reply}
                  active={item.exchange.id === latest?.id && !blocked && !live.active}
                  onNavigate={closeChat}
                  onAction={(action) => void sendQuestion(action.label, action)}
                />
              </div>
            ) : item.message.sender === 'SYSTEM' ? (
              <LiveNote key={`live-${item.message.id}`} message={item.message.body} />
            ) : item.message.sender === 'VISITOR' ? (
              <GuestMessage key={`live-${item.message.id}`} message={item.message.body} />
            ) : (
              <StaffMessage
                key={`live-${item.message.id}`}
                label={copy.live.staffLabel(item.message.author)}
                message={item.message.body}
              />
            ),
          )}

          {offerMessageAfterMiss && (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={blocked}
                onClick={() =>
                  void sendQuestion(copy.live.leaveMessage, {
                    type: 'request_human',
                    label: copy.live.leaveMessage,
                  })
                }
              >
                {copy.live.leaveMessage}
              </button>
            </div>
          )}

          {pendingQuestion && (
            <>
              <GuestMessage message={pendingQuestion} />
              <TypingMessage />
            </>
          )}

          {resetting && <TypingMessage label={chatbotReceptionist.clearing} />}

          {!restoring && !pendingQuestion && !live.active && (
            <div
              className={styles.suggestions}
              role="group"
              aria-label={chatbotReceptionist.suggestionsLabel}
            >
              {suggestions.slice(0, 7).map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  className={styles.chip}
                  disabled={blocked}
                  onClick={() => void sendQuestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          className={styles.composer}
          hidden={infoOpen}
          onSubmit={(event) => {
            event.preventDefault();
            if (live.active) void sendLiveMessage();
            else void sendQuestion(question);
          }}
        >
          {/* A persistent visible label; the error sits between it and the field it describes. */}
          <label htmlFor="zion-chatbot-question" className={styles.inputLabel}>
            {live.active ? copy.live.inputLabel : chatbotReceptionist.inputLabel}
          </label>
          {error && (
            <p id="zion-chatbot-error" className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.inputBar}>
            <textarea
              ref={input}
              id="zion-chatbot-question"
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder={live.active ? copy.live.placeholder : chatbotReceptionist.placeholder}
              value={question}
              readOnly={blocked}
              aria-invalid={Boolean(error)}
              aria-describedby={`zion-chatbot-help${error ? ' zion-chatbot-error' : ''}`}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  if (!question.trim()) return;
                  if (live.active) void sendLiveMessage();
                  else void sendQuestion(question);
                }
              }}
            />
            <button
              ref={sendButton}
              type="submit"
              className={styles.send}
              disabled={blocked || live.sending || !question.trim()}
              aria-label={chatbotReceptionist.send}
              title={chatbotReceptionist.send}
            >
              <SendHorizontal size={19} aria-hidden="true" />
            </button>
          </div>
          <p id="zion-chatbot-help" className={styles.srOnly}>
            {chatbotReceptionist.inputHelp}
          </p>
        </form>
      </dialog>
    </>
  );
}
