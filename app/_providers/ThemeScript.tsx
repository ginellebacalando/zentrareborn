'use client';

import { THEME_SCRIPT } from './theme-script';

/**
 * Applies the website's saved theme before the first paint (theme-script.ts). The server renders
 * the script as JavaScript, so it runs while the page is parsed; React renders it inert
 * (text/plain) in the browser, which avoids its development warning about script tags, and
 * suppressHydrationWarning accepts that difference (Next.js guide "Preventing flash before
 * hydration").
 */
export default function ThemeScript() {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
