'use client';

import Image from 'next/image';
import { UserRound } from 'lucide-react';
import { chatbotReceptionist } from '@/config/chatbot-receptionist';
import styles from './Chatbot.module.css';

export function ChatAvatar({
  participant,
  className = '',
}: {
  participant: 'receptionist' | 'visitor';
  className?: string;
}) {
  const isReceptionist = participant === 'receptionist';
  return (
    <span
      className={`${styles.avatarFrame} ${isReceptionist ? styles.receptionistAvatar : styles.visitorAvatar} ${className}`}
      aria-hidden="true"
    >
      {isReceptionist ? (
        <Image
          {...chatbotReceptionist.avatar}
          alt=""
          unoptimized
          sizes="48px"
          className={styles.avatarImage}
        />
      ) : (
        <UserRound size={18} strokeWidth={2.2} className={styles.visitorIcon} />
      )}
    </span>
  );
}
