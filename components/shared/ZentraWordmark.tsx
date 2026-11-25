import { BRAND } from '@/config/brand';
import { cn } from '@/lib/class-names';

type ZentraWordmarkProps = {
  /** Small uppercase line under the wordmark, for example "Admin dashboard". */
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * The ZENTRA wordmark as live text in the brand font stack (Zenitha Classic, falling back to
 * Cinzel Decorative), so it stays crisp at every size and needs no image request.
 */
export default function ZentraWordmark({ subtitle, size = 'md', className }: ZentraWordmarkProps) {
  return (
    <span className={cn('zentra-wordmark', `zentra-wordmark--${size}`, className)}>
      <span className="zentra-wordmark__name">{BRAND.wordmark}</span>
      {subtitle ? <span className="zentra-wordmark__subtitle">{subtitle}</span> : null}
    </span>
  );
}
