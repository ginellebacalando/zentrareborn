'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Blocks that fade in: each page section, and the footer. */
const TARGETS = 'main section, footer';

/**
 * Scroll reveal for every public page (26 November 2026): a section still below the first screen,
 * and the footer, fades and rises into place as it scrolls into view (app/globals.css, "Scroll
 * reveal"). It replaces a CSS-only version that ran in Chromium alone, so phones on Safari see it
 * too. Progressive by design: the server renders everything visible, and only this script hides
 * what has not been reached yet, never when the visitor prefers reduced motion. Blocks that already
 * reveal themselves (FadeIn's `.reveal`), and sections inside other sections, are left alone.
 * Rendered inside PanelChrome, so the admin and developer workspaces never use it.
 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.scrollReveal = 'shown';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0 },
    );

    // Wait a frame so the new page's content is laid out before measuring it.
    const frame = window.requestAnimationFrame(() => {
      const fold = window.innerHeight;
      document.querySelectorAll<HTMLElement>(TARGETS).forEach((element) => {
        if (element.dataset.scrollReveal) return;
        if (element.closest('.reveal') || element.querySelector('.reveal')) return;
        if (element.parentElement?.closest('section')) return;
        // Anything already on screen stays as it is; only what lies ahead waits for the visitor.
        if (element.getBoundingClientRect().top < fold) return;
        element.dataset.scrollReveal = 'hidden';
        observer.observe(element);
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      // The footer outlives the page: clear its state so it is never stranded hidden and can
      // reveal again on the next page.
      document.querySelectorAll<HTMLElement>('[data-scroll-reveal]').forEach((element) => {
        delete element.dataset.scrollReveal;
      });
    };
  }, [pathname]);

  return null;
}
