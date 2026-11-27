'use client';

import Link from 'next/link';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { buttonClassName, buttonParts, type ButtonLook } from './button-classes';

type ButtonContent = {
  /** A leading Lucide icon; the stylesheet sizes every button icon to 16px. */
  icon?: ReactNode;
  /** A trailing icon, such as an arrow. */
  iconEnd?: ReactNode;
};

export type ButtonProps = Omit<ComponentProps<'button'>, 'className'> &
  ButtonLook &
  ButtonContent & {
    className?: string;
    /** Shows a spinner over the label, keeps the button's width and ignores presses. */
    loading?: boolean;
    /** What assistive technology announces while loading, such as "Saving…". */
    loadingLabel?: string;
    /**
     * Why the button cannot be used yet, such as "Choose a date first". The button then stays
     * focusable but inactive (aria-disabled), so keyboard and screen reader users meet the reason:
     * it becomes the button's description, and the admin panel shows it as the tooltip. Use
     * `disabled` alone for brief states, such as while saving.
     */
    disabledReason?: string | null;
  };

/**
 * The shared button for the website and the admin panel (docs/design-standard.md). `type` keeps
 * the native default, so a button inside a form submits it; pass type="button" otherwise.
 */
export function Button({
  variant,
  size,
  inverse,
  block,
  iconOnly,
  icon,
  iconEnd,
  loading = false,
  loadingLabel,
  disabledReason,
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const reasonId = useId();
  const unavailable = Boolean(disabledReason);
  const describedBy = [rest['aria-describedby'], unavailable ? reasonId : null]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...rest}
      {...(unavailable ? { 'data-tip': disabledReason } : {})}
      className={buttonClassName({ variant, size, inverse, block, iconOnly }, className)}
      disabled={unavailable ? undefined : rest.disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || unavailable || rest['aria-disabled'] || undefined}
      aria-describedby={describedBy || undefined}
      onClick={(event) => {
        if (loading || unavailable) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      <span className={buttonParts.label} aria-hidden={loading && loadingLabel ? true : undefined}>
        {icon}
        {children}
        {iconEnd}
      </span>
      {loading && <span className={buttonParts.spinner} aria-hidden="true" />}
      {loading && loadingLabel && <span className={buttonParts.srOnly}>{loadingLabel}</span>}
      {/* Hidden, so it stays out of the button's name; aria-describedby still reads it. */}
      {unavailable && (
        <span id={reasonId} hidden>
          {disabledReason}
        </span>
      )}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, 'children' | 'icon' | 'iconEnd' | 'iconOnly'> & {
  /** The accessible name, also shown as the tooltip in the admin panel. */
  label: string;
  icon: ReactNode;
  /** Keeps the tooltip inside the right edge of the screen. */
  tooltipAlign?: 'end';
};

/** A square button with only an icon: always named, and with a tooltip in the admin panel. */
export function IconButton({
  label,
  icon,
  tooltipAlign,
  variant = 'ghost',
  ...rest
}: IconButtonProps) {
  return (
    <Button
      {...rest}
      variant={variant}
      iconOnly
      aria-label={label}
      data-tip={label}
      data-tip-align={tooltipAlign}
      icon={icon}
    />
  );
}

export type ButtonLinkProps = Omit<ComponentProps<typeof Link>, 'className'> &
  ButtonLook &
  ButtonContent & { className?: string };

/** A link to another page of the site, drawn as a button. */
export function ButtonLink({
  variant,
  size,
  inverse,
  block,
  iconOnly,
  icon,
  iconEnd,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      {...rest}
      className={buttonClassName({ variant, size, inverse, block, iconOnly }, className)}
    >
      <span className={buttonParts.label}>
        {icon}
        {children}
        {iconEnd}
      </span>
    </Link>
  );
}

export type ButtonAnchorProps = Omit<ComponentProps<'a'>, 'className'> &
  ButtonLook &
  ButtonContent & { className?: string };

/**
 * A plain link drawn as a button: in-page sections (#…), files, email, phone and other sites,
 * where the browser's own navigation is wanted.
 */
export function ButtonAnchor({
  variant,
  size,
  inverse,
  block,
  iconOnly,
  icon,
  iconEnd,
  className,
  children,
  ...rest
}: ButtonAnchorProps) {
  return (
    <a
      {...rest}
      className={buttonClassName({ variant, size, inverse, block, iconOnly }, className)}
    >
      <span className={buttonParts.label}>
        {icon}
        {children}
        {iconEnd}
      </span>
    </a>
  );
}
