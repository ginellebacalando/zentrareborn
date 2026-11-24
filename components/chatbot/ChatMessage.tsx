'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
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

export function ReceptionistMessage({
  reply,
  onNavigate,
  onAction,
  disabled = false,
}: {
  reply: ChatReply;
  onNavigate: () => void;
  onAction?: (action: ReceptionistAction) => void;
  disabled?: boolean;
}) {
  return (
    <ChatMessageFrame participant="receptionist">
      <div className={styles.incomingBubble}>
        <p className={styles.messageText}>{reply.message}</p>
        {reply.sources.length > 0 && (
          <details className={styles.additionalSource}>
            <summary>
              <BookOpen size={16} aria-hidden="true" /> Sources ({reply.sources.length})
            </summary>
            {reply.sources.map((source, index) => (
              <div className={styles.sourceItem} key={`${source.href}-${index}`}>
                <Link className={styles.sourceLink} href={source.href} onClick={onNavigate}>
                  {source.title} <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
                <p className={styles.messageText}>{source.excerpt}</p>
              </div>
            ))}
          </details>
        )}
        {Boolean(reply.actions?.length) && (
          <div className={styles.messageActions} role="group" aria-label="Next steps">
            {reply.actions?.map((action) => (
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
        {reply.kind === 'handoff' && (
          <Link className={styles.sourceLink} href="/contact" onClick={onNavigate}>
            Contact the Zion team <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </ChatMessageFrame>
  );
}
