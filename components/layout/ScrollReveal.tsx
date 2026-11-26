'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Blocks that fade in on public pages: each page section, and the footer. */
const PUBLIC_TARGETS = 'main section, footer';

/**
 * Scroll reveal (26 November 2026): a block still below the first screen fades and rises into
 * place, once, as it scrolls into view (app/globals.css, "Scroll reveal"). Progressive by design:
 * the server renders everything visible, and only this script hides what has not been reached
 * yet, never when the visitor prefers reduced motion. Blocks already on screen are marked
 * "static" and never hidden later, blocks that reveal themselves (FadeIn's `.reveal`) are left
 * alone, and a block inside another target is revealed with it.
 *
 * The public pages use the default targets (rendered inside PanelChrome). The admin panel passes
 * its own and `watch`, because its cards arrive after their data loads.
 */
export default function ScrollReveal({
  targets = PUBLIC_TARGETS,
  watch = false,
}: {
  targets?: string;
  /** Also reveal blocks added after the first paint, such as cards that load their data. */
  watch?: boolean;
}) {
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

    function scan() {
      const fold = window.innerHeight;
      document.querySelectorAll<HTMLElement>(targets).forEach((element) => {
        if (element.dataset.scrollReveal) return;
        if (element.closest('.reveal') || element.querySelector('.reveal')) return;
        if (element.parentElement?.closest(targets)) return;
        // Anything already on screen stays as it is; only what lies ahead waits for the visitor.
        if (element.getBoundingClientRect().top < fold) {
          element.dataset.scrollReveal = 'static';
          return;
        }
        element.dataset.scrollReveal = 'hidden';
        observer.observe(element);
      });
    }

    // Wait a frame so the new page's content is laid out before measuring it.
    let frame = window.requestAnimationFrame(scan);
    const mutations = watch
      ? new MutationObserver(() => {
          window.cancelAnimationFrame(frame);
          frame = window.requestAnimationFrame(scan);
        })
      : null;
    mutations?.observe(document.querySelector('main') ?? document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.cancelAnimationFrame(frame);
      mutations?.disconnect();
      observer.disconnect();
      // The footer outlives the page: clear its state so it is never stranded hidden and can
      // reveal again on the next page.
      document.querySelectorAll<HTMLElement>('[data-scroll-reveal]').forEach((element) => {
        delete element.dataset.scrollReveal;
      });
    };
  }, [pathname, targets, watch]);

  return null;
}
