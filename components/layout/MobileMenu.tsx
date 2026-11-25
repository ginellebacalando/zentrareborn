'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';
import { MAIN_NAV, type NavGroup } from '@/config/navigation';
import ZentraWordmark from '@/components/shared/ZentraWordmark';
import { containDialogFocus } from '@/lib/dialog-focus';
import { cn } from '@/lib/class-names';
import { isGroupCurrent, isNavGroup } from '@/lib/navigation';
import styles from './MobileMenu.module.css';

/** The header breakpoint where the desktop menu row replaces the menu button. */
const DESKTOP_QUERY = '(min-width: 64rem)';

type DrawerGroupProps = {
  group: NavGroup;
  pathname: string;
  onNavigate: () => void;
};

/** The original "Packages" submenu inside the drawer: a disclosure, open on a package page. */
function DrawerGroup({ group, pathname, onNavigate }: DrawerGroupProps) {
  const current = isGroupCurrent(pathname, group);
  const [expanded, setExpanded] = useState(current);
  const listId = useId();

  return (
    <li>
      <button
        type="button"
        className={styles.link}
        aria-expanded={expanded}
        aria-controls={listId}
        data-current={current ? '' : undefined}
        onClick={() => setExpanded((value) => !value)}
      >
        {group.label}
        <ChevronDown aria-hidden="true" className={styles.chevron} strokeWidth={2} />
      </button>
      <ul id={listId} className={styles.subLinks} hidden={!expanded}>
        {group.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={styles.subLink}
              aria-current={link.href === pathname ? 'page' : undefined}
              onClick={onNavigate}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

type MobileMenuProps = {
  pathname: string;
  /** Places the menu button in the header grid. */
  className?: string;
};

/**
 * Phones and tablets: the menu button at the left of the header opens the team's original menu
 * in a drawer from the left edge (a modal dialog). Desktop hides the button and shows the Figma
 * menu row instead. Escape, the close button, a click outside, choosing a page or widening the
 * window to desktop closes it, and focus returns to the menu button.
 */
export default function MobileMenu({ pathname, className }: MobileMenuProps) {
  // Storing the page the menu was opened on closes it after any navigation.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const drawerId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => setOpenOn(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const button = buttonRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();

    // Escape closes the dialog natively; the close event keeps the state in step.
    const onClose = () => setOpenOn(null);
    // A click on the dialog element itself can only be on the backdrop: the panel fills the drawer.
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) setOpenOn(null);
    };
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenOn(null);
    };
    dialog.addEventListener('close', onClose);
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('keydown', containDialogFocus);
    desktop.addEventListener('change', onBreakpoint);

    return () => {
      dialog.removeEventListener('close', onClose);
      dialog.removeEventListener('click', onClick);
      dialog.removeEventListener('keydown', containDialogFocus);
      desktop.removeEventListener('change', onBreakpoint);
      document.body.style.overflow = overflow;
      if (dialog.open) dialog.close();
      button?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(styles.iconButton, styles.trigger, className)}
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpenOn(pathname)}
      >
        <Menu aria-hidden="true" strokeWidth={1.75} />
      </button>
      <dialog ref={dialogRef} id={drawerId} className={styles.drawer} aria-label="Menu">
        <div className={styles.panel}>
          <div className={styles.top}>
            <span aria-hidden="true">
              <ZentraWordmark size="sm" />
            </span>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Close menu"
              onClick={close}
            >
              <X aria-hidden="true" strokeWidth={1.75} />
            </button>
          </div>
          <nav aria-label="Main">
            <ul className={styles.links}>
              {MAIN_NAV.map((item) =>
                isNavGroup(item) ? (
                  // Keyed by page, so the list starts open again on a package page.
                  <DrawerGroup
                    key={`${item.label}:${pathname}`}
                    group={item}
                    pathname={pathname}
                    onNavigate={close}
                  />
                ) : (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={styles.link}
                      aria-current={item.href === pathname ? 'page' : undefined}
                      onClick={close}
                    >
                      {item.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
