'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { IconButton } from '@/components/shared/Button';
import overlay from './Overlays.module.css';

export type MoreMenuItem = {
  label: string;
  onSelect?: () => void;
  /** Navigates instead of acting. */
  href?: string;
  icon?: ReactNode;
  /** Red text, for cancel or delete; the action itself asks for confirmation. */
  destructive?: boolean;
  /** Shown under the label when the item cannot be used yet, which also disables it. */
  unavailable?: string | null;
};

/**
 * The "More" (⋯) menu for an area's less-used actions (docs/admin-design.md), following the WAI-ARIA
 * menu button pattern: Enter, Space or the arrow keys open it on the first item, the arrow keys,
 * Home and End move, Escape and Tab close it, and focus returns to the button.
 */
export default function MoreMenu({
  items,
  label = 'More actions',
  size = 'md',
}: {
  items: MoreMenuItem[];
  label?: string;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function focusItem(index: number) {
    const count = items.length;
    itemRefs.current[(index + count) % count]?.focus();
  }

  function show(index = 0) {
    setOpen(true);
    requestAnimationFrame(() => focusItem(index));
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const current = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown') focusItem(current + 1);
    else if (event.key === 'ArrowUp') focusItem(current - 1);
    else if (event.key === 'Home') focusItem(0);
    else if (event.key === 'End') focusItem(items.length - 1);
    else if (event.key === 'Escape') close();
    else if (event.key === 'Tab') return setOpen(false);
    else return;
    event.preventDefault();
  }

  if (!items.length) return null;
  return (
    <div ref={wrapRef} className={overlay.menuWrap}>
      <IconButton
        ref={buttonRef}
        type="button"
        variant="secondary"
        size={size}
        label={label}
        tooltipAlign="end"
        icon={<MoreHorizontal aria-hidden="true" />}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            show(event.key === 'ArrowUp' ? items.length - 1 : 0);
          }
        }}
      />
      {open && (
        <div
          id={`${id}-menu`}
          role="menu"
          tabIndex={-1}
          aria-label={label}
          className={overlay.menu}
          onKeyDown={onMenuKey}
        >
          {items.map((item, index) => {
            const className = `${overlay.menuItem} ${item.destructive ? overlay.menuDanger : ''}`;
            const content = (
              <>
                {item.icon}
                <span className={overlay.menuLabel}>
                  {item.label}
                  {item.unavailable && <small>{item.unavailable}</small>}
                </span>
              </>
            );
            return item.href && !item.unavailable ? (
              <Link
                key={item.label}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                role="menuitem"
                tabIndex={-1}
                href={item.href}
                className={className}
                onClick={() => setOpen(false)}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={className}
                aria-disabled={item.unavailable ? true : undefined}
                onClick={() => {
                  if (item.unavailable) return;
                  close();
                  item.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
