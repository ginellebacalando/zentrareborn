'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { BOOK_LINK, MAIN_NAV, type NavGroup } from '@/config/navigation';
import ZentraWordmark from '@/components/shared/ZentraWordmark';
import { isGroupCurrent, isNavGroup } from '@/lib/navigation';
import styles from './GlobalHeader.module.css';

/** Scroll offsets (px) for condensing the header; the gap keeps it from flickering at the edge. */
const CONDENSE_AFTER = 96;
const EXPAND_BEFORE = 48;
/** Scrolls shorter than this (px) are ignored, so small jitters never slide the header. */
const SCROLL_STEP = 8;

type HeaderScroll = {
  /** Scrolled past the full header: wide desktops show one slim row. */
  condensed: boolean;
  /**
   * The page where the visitor last scrolled down, or null. Phones and tablets slide the header
   * away until the next scroll up; storing the path brings it back after navigating.
   */
  hiddenOn: string | null;
};

function useHeaderScroll(): HeaderScroll {
  const [state, setState] = useState<HeaderScroll>({ condensed: false, hiddenOn: null });

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = window.scrollY;
      const moved = Math.abs(offset - last) >= SCROLL_STEP;
      const down = offset > last;
      if (moved) last = offset;
      const path = window.location.pathname;
      setState((current) => {
        const condensed = current.condensed ? offset > EXPAND_BEFORE : offset > CONDENSE_AFTER;
        const hiddenOn = moved ? (down && offset > CONDENSE_AFTER ? path : null) : current.hiddenOn;
        return condensed === current.condensed && hiddenOn === current.hiddenOn
          ? current
          : { condensed, hiddenOn };
      });
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}

/**
 * The original "Packages" submenu as a disclosure: the button opens the event-type links right
 * under the links row. Escape, a click elsewhere, moving focus away or navigating closes it.
 */
function NavGroupItem({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const panelId = useId();
  const itemRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!itemRef.current?.contains(event.target as Node)) setOpenOn(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenOn(null);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <li
      ref={itemRef}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpenOn(null);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.link}
        aria-expanded={open}
        aria-controls={panelId}
        data-current={isGroupCurrent(pathname, group) ? '' : undefined}
        onClick={() => setOpenOn(open ? null : pathname)}
      >
        {group.label}
        <ChevronDown aria-hidden="true" className={styles.chevron} strokeWidth={2} />
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <ul className={styles.panelLinks}>
          {group.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={styles.panelLink}
                aria-current={link.href === pathname ? 'page' : undefined}
                onClick={() => setOpenOn(null)}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/**
 * Figma header with the team's original menu items. Desktop: the centered ZENTRA wordmark with
 * BOOK NOW at the right and the menu in a row between hairlines; wide screens condense it into
 * one slim row after scrolling. Phones and tablets keep the same two rows (the menu row scrolls
 * sideways) and slide the header away while scrolling down. There is no menu button.
 *
 * The bar is fixed and a spacer reserves its full height, so it never moves the page content.
 */
export default function GlobalHeader() {
  const pathname = usePathname();
  const { condensed, hiddenOn } = useHeaderScroll();

  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      <header
        className={styles.header}
        data-condensed={condensed ? '' : undefined}
        data-hidden={hiddenOn === pathname ? '' : undefined}
      >
        <div className={styles.inner}>
          <Link href="/" className={styles.brand} aria-label={`${BRAND.wordmark} home`}>
            <ZentraWordmark />
          </Link>
          <nav aria-label="Main" className={styles.nav}>
            <ul className={styles.links}>
              {MAIN_NAV.map((item) =>
                isNavGroup(item) ? (
                  <NavGroupItem key={item.label} group={item} pathname={pathname} />
                ) : (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={styles.link}
                      aria-current={item.href === pathname ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
          <Link
            href={BOOK_LINK.href}
            className={styles.book}
            aria-current={BOOK_LINK.href === pathname ? 'page' : undefined}
          >
            {BOOK_LINK.label}
          </Link>
        </div>
      </header>
    </>
  );
}
