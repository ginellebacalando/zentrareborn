'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { chatbotReceptionist } from '@/config/chatbot-receptionist';
import type { ChatReply, ReceptionistAction } from '@/lib/chatbot/types';
import { ChatAvatar } from './ChatAvatar';
import styles from './Chatbot.module.css';

export function ChatMessageFrame({
  participant = 'receptionist',
  children,
}: {
  participant?: 'receptionist' | 'visitor';
  children: ReactNode;
}) {
  const visitor = participant === 'visitor';
  return (
    <div className={visitor ? styles.visitorTurn : styles.assistantTurn}>
      <span className={styles.senderLabel}>{visitor ? 'You' : chatbotReceptionist.name}</span>
      <div className={styles.messageRow}>
        {!visitor && <ChatAvatar participant="receptionist" className={styles.messageAvatar} />}
        <div className={styles.bubbleWrapper}>{children}</div>
        {visitor && <ChatAvatar participant="visitor" className={styles.messageAvatar} />}
      </div>
    </div>
  );
}

export function VisitorMessage({ message }: { message: string }) {
  return (
    <ChatMessageFrame participant="visitor">
      <div className={styles.outgoingBubble}>
        <p className={styles.messageText}>{message}</p>
      </div>
    </ChatMessageFrame>
  );
}

export function TypingMessage({ label = 'Zeni is replying…' }: { label?: string }) {
  return (
    <ChatMessageFrame participant="receptionist">
      <div className={styles.pendingBubble} role="status">
        <span className={styles.srOnly}>{label}</span>
        <span className={styles.typingDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    </ChatMessageFrame>
  );
}

const CONTACT_INTENT_PATTERN =
  /\b(contact|message\s+us|message\s+the\s+team|reach\s+out|talk\s+to|speak\s+to|call|email|inquir\w*|human|staff|agent|coordinator|zion\s+team)\b/i;

export function ReceptionistMessage({
  reply,
  question = '',
  onNavigate,
  onAction,
  disabled = false,
}: {
  reply: ChatReply;
  question?: string;
  onNavigate: () => void;
  onAction?: (action: ReceptionistAction) => void;
  disabled?: boolean;
}) {
  const visibleActions = (reply.actions ?? []).filter(
    (action) =>
      action.type !== 'start_escalation' && !/^ask\s+the\s+team$/i.test(action.label.trim()),
  );
  const wantsToContactTeam =
    reply.kind === 'handoff' ||
    CONTACT_INTENT_PATTERN.test(question) ||
    Boolean(reply.actions?.some((action) => action.type === 'start_escalation')) ||
    reply.sources.some((source) => source.href === '/contact');

  return (
    <ChatMessageFrame participant="receptionist">
      <div className={styles.incomingBubble}>
        <p className={styles.messageText}>{reply.message}</p>
        {visibleActions.length > 0 && (
          <div className={styles.messageActions} role="group" aria-label="Next steps">
            {visibleActions.map((action) => (
              <button
                key={`${action.type}-${action.value ?? ''}`}
                type="button"
                disabled={disabled || !onAction}
                onClick={() => onAction?.(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
        {wantsToContactTeam && (
          <Link className={styles.sourceLink} href="/contact#message-us" onClick={onNavigate}>
            Contact the Zion team <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </ChatMessageFrame>
  );
}
