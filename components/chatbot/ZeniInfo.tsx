'use client';

import type { RefObject } from 'react';
import { ArrowLeft } from 'lucide-react';
import { chatbotReceptionist } from '@/config/chatbot-receptionist';
import type { ConversationSummary } from '@/lib/chatbot/types';
import styles from './Chatbot.module.css';

type ZeniInfoProps = {
  id: string;
  context: ConversationSummary | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
};

/** "How Zeni works": scope, limits, staff access and the privacy contract, in plain words. */
export function ZeniInfo({ id, context, headingRef, onBack }: ZeniInfoProps) {
  const info = chatbotReceptionist.info;
  const remembered = [
    ['Name', context?.name],
    ['Contact', context?.contact],
    ['Event', context?.eventType],
    ['Date', context?.date],
    ['Guests', context?.guests?.toString()],
    ['Preferred time', context?.timePreference],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <section id={id} className={styles.info} aria-labelledby={`${id}-title`}>
      <h3 ref={headingRef} id={`${id}-title`} className={styles.infoTitle} tabIndex={-1}>
        {chatbotReceptionist.howItWorks}
      </h3>
      <ul className={styles.infoList}>
        {info.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <h4 className={styles.infoSubtitle}>{info.privacyTitle}</h4>
      <ul className={styles.infoList}>
        {info.privacy.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {remembered.length > 0 && (
        <>
          <h4 className={styles.infoSubtitle}>{info.remembered}</h4>
          <dl className={styles.remembered}>
            {remembered.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <button type="button" className={styles.secondaryAction} onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        {chatbotReceptionist.backToChat}
      </button>
    </section>
  );
}
