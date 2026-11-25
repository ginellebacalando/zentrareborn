'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Smooth page changes on the public site (docs/design-change-log.md, 26 November 2026):
 * - a slim progress bar at the top starts as soon as a link to another page is clicked and completes
 *   when the new page arrives, so every click gets an answer even while a live page loads;
 * - the new page's main content then fades and rises into place (about 0.45s).
 * No Suspense boundary is involved, so server redirects and 404s keep their status codes. The first
 * load is left alone, and nothing moves under reduced motion. Rendered inside PanelChrome, so the
 * admin and developer workspaces keep their own behaviour.
 */
export default function RouteTransition() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  // The page a navigation started from; the bar runs while we are still on it.
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const state = startedOn === null ? 'idle' : startedOn === pathname ? 'loading' : 'done';

  useEffect(() => {
    // Capture phase: runs before next/link handles (and prevents) the click.
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname)
        return;
      setStartedOn(window.location.pathname);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (state === 'idle') return;
    // Finish the bar, then rest; a navigation that never lands stops after a while.
    const timer = window.setTimeout(() => setStartedOn(null), state === 'done' ? 450 : 12_000);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const main = document.getElementById('main-content');
    if (!main || typeof main.animate !== 'function') return;
    // No fill: once finished, no transform stays behind to affect sticky or fixed elements.
    main.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 450, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
  }, [pathname]);

  return <div className="route-progress" data-state={state} aria-hidden="true" />;
}
