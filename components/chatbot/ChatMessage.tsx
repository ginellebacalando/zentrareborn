'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, FileText } from 'lucide-react';
import { Button, ButtonAnchor, ButtonLink } from '@/components/shared/Button';
import { chatbotReceptionist } from '@/config/chatbot-receptionist';
import type { ChatReply, ReceptionistAction } from '@/lib/chatbot/types';
import { ChatAvatar } from './ChatAvatar';
import { CalendarCard, DetailCard } from './ChatCards';
import { ZeniText } from './ZeniText';
import styles from './Chatbot.module.css';

export function GuestMessage({ message }: { message: string }) {
  return (
    <div className={`${styles.turn} ${styles.guestTurn}`}>
      <p className={styles.guestBubble}>
        <span className={styles.srOnly}>{chatbotReceptionist.you}: </span>
        {message}
      </p>
    </div>
  );
}

/** A message from a real staff member in the live chat, labelled with their first name. */
export function StaffMessage({ label, message }: { label: string; message: string }) {
  return (
    <div className={`${styles.turn} ${styles.zeniTurn}`}>
      <div className={styles.zeniStack}>
        {/* Read once, with the message, through the hidden prefix below. */}
        <p className={styles.staffLabel} aria-hidden="true">
          {label}
        </p>
        <div className={`${styles.zeniBubble} ${styles.staffBubble}`}>
          <p className={styles.messageText}>
            <span className={styles.srOnly}>{label}: </span>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

/** A short line from the system in the live chat ("Maria joined the chat."). */
export function LiveNote({ message }: { message: string }) {
  return <p className={styles.liveNote}>{message}</p>;
}

export function ZeniBubble({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.turn} ${styles.zeniTurn}`}>
      <ChatAvatar className={styles.turnAvatar} />
      <div className={styles.zeniStack}>{children}</div>
    </div>
  );
}

/** A calm, static waiting line such as "Zeni is typing…"; the same text is announced. */
export function TypingMessage({ label = chatbotReceptionist.typing }: { label?: string }) {
  return (
    <ZeniBubble>
      <div className={styles.typing} role="status">
        {label}
      </div>
    </ZeniBubble>
  );
}

/** A Zeni reply: text, then cards, then server-built links and actions, then its sources. */
export function ZeniMessage({
  reply,
  active,
  onAction,
  onNavigate,
}: {
  reply: ChatReply;
  /** Only the latest reply's buttons can act; older ones stay visible but inactive. */
  active: boolean;
  onAction: (action: ReceptionistAction) => void;
  onNavigate: () => void;
}) {
  const links = reply.links ?? [];
  const actions = reply.actions ?? [];
  const sources = reply.sources.slice(0, 2);
  return (
    <ZeniBubble>
      <div className={styles.zeniBubble}>
        <ZeniText
          message={reply.message}
          className={styles.richText}
          prefix={<span className={styles.srOnly}>{chatbotReceptionist.name}: </span>}
        />
      </div>
      {(reply.cards ?? []).map((card, index) =>
        card.type === 'calendar' ? (
          <CalendarCard
            key={`calendar-${index}`}
            card={card}
            language={reply.language}
            disabled={!active}
            onPick={(date, label) => onAction({ type: 'check_availability', value: date, label })}
          />
        ) : (
          <DetailCard key={card.id} card={card} onNavigate={onNavigate} />
        ),
      )}
      {links.length + actions.length > 0 && (
        <div className={styles.actions} role="group" aria-label={chatbotReceptionist.nextSteps}>
          {links.map((link) =>
            link.kind === 'page' ? (
              <ButtonLink
                key={link.href}
                href={link.href}
                variant={link.primary ? 'primary' : 'secondary'}
                onClick={onNavigate}
              >
                {link.label}
              </ButtonLink>
            ) : (
              // A full page load lets the booking and contact forms read the pre-filled values.
              <ButtonAnchor
                key={link.href}
                href={link.href}
                variant={link.primary ? 'primary' : 'secondary'}
                onClick={onNavigate}
              >
                {link.label}
              </ButtonAnchor>
            ),
          )}
          {actions.map((action) => (
            <Button
              key={`${action.type}-${action.value ?? ''}`}
              type="button"
              variant="secondary"
              disabled={!active}
              onClick={() => onAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
      {sources.length > 0 && (
        <ul className={styles.sources} aria-label={chatbotReceptionist.sourcesLabel}>
          {sources.map((source) => (
            <li key={`${source.href}-${source.title}`}>
              <Link href={source.href} className={styles.sourceLink} onClick={onNavigate}>
                <FileText size={14} aria-hidden="true" />
                <span>
                  {chatbotReceptionist.sourcesLabel}: {source.title}
                </span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ZeniBubble>
  );
}
