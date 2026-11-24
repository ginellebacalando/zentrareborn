import { cn } from '@/lib/class-names';

type ZentraMonogramProps = {
  /** Outline: green ring on white (Figma's launcher). Solid: white letter on green. */
  variant?: 'outline' | 'solid';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * The serif "Z" monogram from the ZENTRA brand, used for Zeni's avatar and launcher.
 * It is decorative: give the control or message that contains it an accessible name.
 */
export default function ZentraMonogram({
  variant = 'outline',
  size = 'md',
  className,
}: ZentraMonogramProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'zentra-monogram',
        `zentra-monogram--${variant}`,
        `zentra-monogram--${size}`,
        className,
      )}
    >
      Z
    </span>
  );
}
