'use client';

import type { ReactNode } from 'react';

export const OPEN_CHATBOT_EVENT = 'zion:open-chatbot';

export type OpenChatbotDetail = {
  reset?: boolean;
  prompt?: string;
};

export function openChatbotConversation(detail: OpenChatbotDetail = { reset: true }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenChatbotDetail>(OPEN_CHATBOT_EVENT, { detail }));
}

export default function OpenChatbotButton({
  prompt,
  reset = true,
  className,
  children,
  ariaLabel,
}: {
  prompt?: string;
  reset?: boolean;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => openChatbotConversation({ reset, prompt })}
      className={className}
    >
      {children}
    </button>
  );
}
