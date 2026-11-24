import ZentraMonogram from '@/components/shared/ZentraMonogram';
import styles from './Chatbot.module.css';

/** Zeni's avatar is the ZENTRA "Z" monogram; it is decorative next to labelled text. */
export function ChatAvatar({
  size = 'sm',
  className = '',
}: {
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <ZentraMonogram variant="outline" size={size} className={`${styles.avatar} ${className}`} />
  );
}
