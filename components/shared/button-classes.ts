import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonLook = {
  /** primary: the one main action of an area; ghost: low-priority actions. Default secondary. */
  variant?: ButtonVariant;
  /** sm 32px (tables, toolbars), md 40px (default), lg 48px (website calls to action). */
  size?: ButtonSize;
  /** White instead of green, for photographs and dark brand panels. */
  inverse?: boolean;
  /** Fills the width of its container. */
  block?: boolean;
  /** A square button that shows only an icon; give it an accessible name. */
  iconOnly?: boolean;
};

/**
 * Class names of the shared button (components/shared/Button.tsx), for the rare element that must
 * look like a button but cannot be one, such as the label of a file input. Server-safe.
 */
export function buttonClassName(
  { variant = 'secondary', size = 'md', inverse, block, iconOnly }: ButtonLook = {},
  extra?: string,
) {
  return [
    styles.button,
    styles[variant],
    styles[size],
    inverse && styles.inverse,
    block && styles.block,
    iconOnly && styles.iconOnly,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export const buttonParts = { label: styles.label, spinner: styles.spinner, srOnly: styles.srOnly };
