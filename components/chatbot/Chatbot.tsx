'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Send, Smile, X } from 'lucide-react';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { chatbotEmojiGroups, chatbotReceptionist } from '@/config/chatbot-receptionist';
import { containDialogFocus } from '@/lib/dialog-focus';
import type { ChatReply, ConversationSummary, ReceptionistAction } from '@/lib/chatbot/types';
import {
  ChatMessageFrame,
  ReceptionistMessage,
  TypingMessage,
  VisitorMessage,
} from './ChatMessage';
import { ChatAvatar } from './ChatAvatar';
import { ChatLauncher } from './ChatLauncher';
import styles from './Chatbot.module.css';

type Exchange = { id: string; question: string; reply: ChatReply };

const initialSuggestions = ['About Us', 'Packages', 'FAQ', 'Visiting Hours', 'Prices'];

const suggestionQueries: Record<string, string> = {
  'About Us': 'Tell me about Zion Events Place',
  Packages: 'Wedding packages',
  FAQ: 'What are your venue policies and FAQs?',
  'Visiting Hours': 'What are your visiting hours?',
  Prices: 'Package prices and rates',
  'Find us': 'Where are you located?',
  'Contact the team': 'How do I contact your team?',
};

const suggestionLabels: Record<string, string> = {
  'Where are you located?': 'Find us',
  'Wedding packages': 'Packages',
  'What are your visiting hours?': 'Visiting Hours',
  'How do I contact your team?': 'Contact the team',
  'Tell me about Zion Events Place': 'About Us',
  'Package prices and rates': 'Prices',
  'What are your venue policies and FAQs?': 'FAQ',
  'About Us': 'About Us',
  Packages: 'Packages',
  FAQ: 'FAQ',
  'Visiting Hours': 'Visiting Hours',
  Prices: 'Prices',
};

const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const PLACEHOLDER_TEXT = 'Type a message...';

export default function Chatbot() {
  // A server-rendered launcher must not accept clicks before its dialog handlers hydrate.
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [placeholderCount, setPlaceholderCount] = useState(PLACEHOLDER_TEXT.length);
  const [placeholderDeleting, setPlaceholderDeleting] = useState(false);
  const [placeholderPaused, setPlaceholderPaused] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [error, setError] = useState('');
  const [context, setContext] = useState<ConversationSummary | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [recovery, setRecovery] = useState<{
    question: string;
    turnId: string;
    action?: Pick<ReceptionistAction, 'type' | 'value'>;
  } | null>(null);
  const restored = useRef(false);
  const retryTurn = useRef<{
    fingerprint: string;
    turnId: string;
    question: string;
    action?: Pick<ReceptionistAction, 'type' | 'value'>;
  } | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const smileyButton = useRef<HTMLButtonElement>(null);
  const emojiPicker = useRef<HTMLDivElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const shouldAnimatePlaceholder = open && !reducedMotion && !question && !inputFocused;

  useEffect(() => {
    if (!shouldAnimatePlaceholder) return;

    let delay = placeholderDeleting ? 45 : 85;
    if (!placeholderDeleting && placeholderCount === PLACEHOLDER_TEXT.length) {
      delay = placeholderPaused ? 2_200 : 120;
    } else if (placeholderDeleting && placeholderCount === 0) {
      delay = 450;
    }

    const timer = window.setTimeout(() => {
      if (!placeholderDeleting) {
        if (placeholderCount < PLACEHOLDER_TEXT.length) {
          setPlaceholderCount((count) => count + 1);
          setPlaceholderPaused(false);
        } else if (!placeholderPaused) {
          setPlaceholderPaused(true);
        } else {
          setPlaceholderDeleting(true);
          setPlaceholderPaused(false);
        }
      } else if (placeholderCount > 0) {
        setPlaceholderCount((count) => count - 1);
      } else {
        setPlaceholderDeleting(false);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [shouldAnimatePlaceholder, placeholderCount, placeholderDeleting, placeholderPaused]);

  useEffect(() => {
    if (!shouldAnimatePlaceholder || !placeholderPaused) return;
    const blink = window.setInterval(() => {
      setCursorVisible((visible) => !visible);
    }, 480);
    return () => window.clearInterval(blink);
  }, [shouldAnimatePlaceholder, placeholderPaused]);

  useEffect(() => {
    if (!emojiOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (emojiPicker.current?.contains(target) || smileyButton.current?.contains(target)) return;
      setEmojiOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [emojiOpen]);

  const animatedNativePlaceholder = shouldAnimatePlaceholder
    ? `${PLACEHOLDER_TEXT.slice(0, placeholderCount)}${placeholderPaused ? (cursorVisible ? '|' : '') : '|'}`
    : PLACEHOLDER_TEXT;

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const trigger = launcher.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (element && !element.open) element.showModal();
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      // The initial heading is outside the sequential Tab order.
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
      if (dismiss) setOpen(false);
    };
    element?.addEventListener('keydown', handleDialogKeyDown);
    element?.addEventListener('pointerdown', handlePointerDown);
    element?.addEventListener('pointercancel', resetPointer);
    element?.addEventListener('click', handleBackdropClick);
    // Start at the welcome rather than scrolling small screens down to the composer.
    title.current?.focus({ preventScroll: true });
    if (element) element.scrollTop = 0;
    return () => {
      element?.removeEventListener('keydown', handleDialogKeyDown);
      element?.removeEventListener('pointerdown', handlePointerDown);
      element?.removeEventListener('pointercancel', resetPointer);
      element?.removeEventListener('click', handleBackdropClick);
      element?.close();
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const element = conversation.current;
    if (open && element)
      element.scrollTop = history.length || pendingQuestion ? element.scrollHeight : 0;
  }, [history, pendingQuestion, open, restoring]);

  async function restoreConversation(showMessage = false) {
    const response = await fetch('/api/client/chatbot', { cache: 'no-store' });
    const payload = (await response.json()) as {
      reply?: ChatReply;
      error?: string;
      retry?: {
        question: string;
        turnId: string;
        action?: Pick<ReceptionistAction, 'type' | 'value'>;
      };
    };
    if (!response.ok)
      throw new Error(
        payload.error ||
          'Your saved details could not be restored. Please retry or contact the team.',
      );
    setContext(payload.reply?.context ?? null);
    setRecovery(payload.retry ?? null);
    if (showMessage && payload.reply)
      setHistory([{ id: crypto.randomUUID(), question: '', reply: payload.reply }]);
    restored.current = true;
  }

  function openConversation() {
    setOpen(true);
    if (restored.current) return;
    setRestoring(true);
    void restoreConversation(true)
      .catch((failure: unknown) =>
        setError(
          failure instanceof Error ? failure.message : 'Saved details could not be restored.',
        ),
      )
      .finally(() => setRestoring(false));
  }

  async function sendQuestion(
    value: string,
    selectedAction?: ReceptionistAction,
    recoveryTurnId?: string,
  ) {
    const submitted = value.trim();
    if (activeRequest.current || restoring || resetting) return;
    if (!submitted || submitted.length > 600) {
      setError('Enter a question of 1–600 characters.');
      input.current?.focus();
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    setQuestion(submitted);
    setPendingQuestion(submitted);
    setError('');
    // Retrying a failed action from the retained composer must preserve its command.
    const commandAction = selectedAction
      ? {
          type: selectedAction.type,
          ...(selectedAction.value ? { value: selectedAction.value } : {}),
        }
      : retryTurn.current?.question === submitted
        ? retryTurn.current.action
        : undefined;
    const fingerprint = JSON.stringify({ question: submitted, action: commandAction });
    if (retryTurn.current?.fingerprint !== fingerprint)
      retryTurn.current = {
        fingerprint,
        turnId: crypto.randomUUID(),
        question: submitted,
        action: commandAction,
      };
    if (recoveryTurnId)
      retryTurn.current = {
        fingerprint,
        turnId: recoveryTurnId,
        question: submitted,
        action: commandAction,
      };
    if (selectedAction) input.current?.focus({ preventScroll: true });
    const timeout = window.setTimeout(() => controller.abort('timeout'), 25000);
    try {
      const response = await fetch('/api/client/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          question: submitted,
          turnId: retryTurn.current.turnId,
          expectedRevision: context?.revision,
          action: commandAction,
        }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (response.status === 409) await restoreConversation();
      if (!response.ok)
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'The assistant is unavailable. Please try again.',
        );
      const reply = payload as ChatReply;
      if (
        !Array.isArray(reply.sources) ||
        !Array.isArray(reply.suggestions) ||
        typeof reply.message !== 'string'
      ) {
        throw new Error('The assistant returned an incomplete answer. Please try again.');
      }
      setHistory((previous) => [
        ...previous.slice(-19),
        { id: crypto.randomUUID(), question: submitted, reply },
      ]);
      setContext(reply.context ?? null);
      retryTurn.current = null;
      setRecovery(null);
      setQuestion('');
    } catch (failure) {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') {
        setError(
          controller.signal.reason === 'timeout'
            ? 'The assistant took too long to respond. Your question is saved below; try sending it again or contact the team.'
            : failure instanceof TypeError
              ? 'Unable to connect. Check your connection and try again.'
              : failure instanceof Error
                ? failure.message
                : 'Unable to answer. Please try again.',
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

  const suggestions = history.at(-1)?.reply.suggestions?.length
    ? history.at(-1)!.reply.suggestions
    : initialSuggestions;

  const clearConversation = async () => {
    if (activeRequest.current || restoring || resetting) return;
    setResetting(true);
    try {
      const response = await fetch('/api/client/chatbot', { method: 'DELETE', cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'Your saved details could not be cleared. Please retry.',
        );
      setHistory([]);
      setQuestion('');
      setError('');
      setContext(null);
      setRecovery(null);
      retryTurn.current = null;
      title.current?.focus({ preventScroll: true });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Your saved details could not be cleared. Please retry.',
      );
    } finally {
      setResetting(false);
    }
  };

  const busy = Boolean(pendingQuestion) || restoring || resetting;

  return (
    <>
      <ChatLauncher buttonRef={launcher} ready={ready} open={open} onOpen={openConversation} />
      <dialog
        ref={dialog}
        id="zion-chatbot"
        className={styles.dialog}
        aria-labelledby="zion-chatbot-title"
        aria-describedby="zion-chatbot-description"
        onCancel={(event) => {
          event.preventDefault();
          if (emojiOpen) {
            setEmojiOpen(false);
            smileyButton.current?.focus({ preventScroll: true });
            return;
          }
          setOpen(false);
        }}
      >
        <header className={styles.header}>
          <div className={styles.identity}>
            <ChatAvatar participant="receptionist" className={styles.headerProfile} />
            <div className={styles.identityText}>
              <h2 ref={title} id="zion-chatbot-title" tabIndex={-1}>
                {chatbotReceptionist.name}
              </h2>
              <p id="zion-chatbot-description">Virtual Receptionist</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Close chat"
              title="Close chat"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" size={20} strokeWidth={2.4} />
            </button>
          </div>
        </header>

        <div
          ref={conversation}
          className={styles.conversation}
          role="log"
          aria-label="Conversation with Zeni"
          aria-relevant="additions"
        >
          {!restoring && !history.length && (
            <ChatMessageFrame participant="receptionist">
              <div className={styles.incomingBubble}>
                <p className={styles.welcome}>Welcome to Zion Events Place.</p>
                <p>I’m Zeni, your virtual receptionist. How may I assist you today?</p>
              </div>
            </ChatMessageFrame>
          )}

          {restoring && <TypingMessage label="Opening your conversation…" />}

          {recovery && (
            <div className={styles.recovery}>
              <p className={styles.welcome}>Your last message was interrupted.</p>
              <p className={styles.help}>Retry it or forget the saved details to continue.</p>
              <div
                className={styles.messageActions}
                role="group"
                aria-label="Recover your conversation"
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void sendQuestion(
                      recovery.question,
                      recovery.action
                        ? { ...recovery.action, label: recovery.question }
                        : undefined,
                      recovery.turnId,
                    );
                  }}
                >
                  Retry previous message
                </button>
                <button
                  type="button"
                  className={styles.forget}
                  disabled={busy}
                  onClick={() => {
                    void clearConversation();
                  }}
                >
                  Forget saved details
                </button>
              </div>
              <p className={styles.help}>
                Forgetting details does not cancel bookings or submitted inquiries.
              </p>
            </div>
          )}

          {history.map((exchange, index) => (
            <div key={exchange.id} className={styles.exchange}>
              {exchange.question && <VisitorMessage message={exchange.question} />}
              <ReceptionistMessage
                reply={exchange.reply}
                onNavigate={() => setOpen(false)}
                disabled={busy || Boolean(recovery) || index !== history.length - 1}
                onAction={(action) => {
                  void sendQuestion(action.label, action);
                }}
              />
            </div>
          ))}

          {pendingQuestion && (
            <>
              <VisitorMessage message={pendingQuestion} />
              <TypingMessage />
            </>
          )}

          {resetting && <TypingMessage label="Forgetting your saved details…" />}

          {!restoring && (
            <div className={styles.suggestions} role="group" aria-label="Suggested questions">
              {suggestions.map((suggestion) => {
                const label = suggestionLabels[suggestion] ?? suggestion;
                const query = suggestionQueries[suggestion] ?? suggestion;
                return (
                  <button
                    type="button"
                    key={suggestion}
                    disabled={busy || Boolean(recovery)}
                    onClick={() => {
                      void sendQuestion(query);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.composer}>
          {emojiOpen && (
            <div
              ref={emojiPicker}
              id="zion-chatbot-emojis"
              className={styles.emojiPicker}
              role="region"
              aria-label="Event and celebration emojis"
            >
              {chatbotEmojiGroups.map((group) => (
                <div key={group.label} className={styles.emojiGroup}>
                  <p className={styles.emojiGroupTitle}>{group.label}</p>
                  <div className={styles.emojiGrid}>
                    {group.emojis.map((emoji) => (
                      <button
                        key={emoji.symbol}
                        type="button"
                        className={styles.emojiButton}
                        aria-label={`Insert ${emoji.name}`}
                        title={emoji.name}
                        onClick={() => {
                          const el = input.current;
                          const start = el?.selectionStart ?? question.length;
                          const end = el?.selectionEnd ?? question.length;
                          const next =
                            `${question.slice(0, start)}${emoji.symbol}${question.slice(end)}`.slice(
                              0,
                              600,
                            );
                          setQuestion(next);
                          window.requestAnimationFrame(() => {
                            if (!el) return;
                            const caret = Math.min(start + emoji.symbol.length, 600);
                            el.focus();
                            el.setSelectionRange(caret, caret);
                          });
                        }}
                      >
                        <span aria-hidden="true">{emoji.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              setEmojiOpen(false);
              void sendQuestion(question);
            }}
          >
            <div className={styles.composerRow}>
              <button
                ref={smileyButton}
                type="button"
                className={styles.smileyButton}
                aria-label="Choose an event emoji"
                title="Event & celebration emojis"
                aria-expanded={emojiOpen}
                aria-controls="zion-chatbot-emojis"
                disabled={busy || Boolean(recovery)}
                onClick={() => setEmojiOpen((previous) => !previous)}
              >
                <Smile size={22} strokeWidth={2} aria-hidden="true" />
              </button>

              <div className={styles.inputBar}>
                <textarea
                  ref={input}
                  id="zion-chatbot-question"
                  rows={1}
                  maxLength={600}
                  placeholder={animatedNativePlaceholder}
                  value={question}
                  readOnly={busy || Boolean(recovery)}
                  aria-invalid={Boolean(error)}
                  aria-label="Your message"
                  aria-describedby={`zion-chatbot-help zion-chatbot-count${error ? ' zion-chatbot-error' : ''}`}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      setEmojiOpen(false);
                      if (question.trim()) void sendQuestion(question);
                    }
                  }}
                />
                <button
                  ref={sendButton}
                  type="submit"
                  className={styles.send}
                  disabled={busy || Boolean(recovery) || !question.trim()}
                  aria-label="Send message"
                  title="Send message"
                >
                  <Send aria-hidden="true" size={18} strokeWidth={2.2} />
                </button>
              </div>
            </div>

            <div className={styles.composerMeta}>
              <span id="zion-chatbot-count" className={styles.srOnly}>
                {question.length} / 600 characters
              </span>
              <p id="zion-chatbot-help" className={styles.srOnly}>
                Never share passwords, codes, card details or ID documents.
              </p>
              {error && (
                <p id="zion-chatbot-error" className={styles.error} role="alert">
                  {error}
                </p>
              )}
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
