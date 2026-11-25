import type { Metadata, Viewport } from 'next';
import { existsSync } from 'node:fs';
import path from 'node:path';
import './globals.css';
import '@/styles/primitives.css';

import GlobalBackground from '@/components/layout/GlobalBackground';
import GlobalHeader from '@/components/layout/GlobalHeader';
import Footer from '@/components/layout/Footer';
import { BRAND } from '@/config/brand';
import { ThemeProvider } from './_providers/ThemeProvider';
import PanelChrome from '@/components/layout/PanelChrome';
import SkipLink from '@/components/layout/SkipLink';
import RouteTransition from '@/components/layout/RouteTransition';
import { archivo, archivoExtended, cinzelDecorative } from './_fonts';
import Chatbot from '@/components/chatbot/Chatbot';

/**
 * The plan's licensed fonts exist only on a team machine after `npm run fonts:licensed` (the
 * folder is ignored by Git), so deployments always use the bundled open-license fallbacks.
 */
const hasLicensedFonts = existsSync(
  path.join(process.cwd(), 'public', 'fonts', 'licensed', 'fonts.css'),
);

export const metadata: Metadata = {
  title: BRAND.siteTitle,
  description: BRAND.tagline,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#07140F' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${archivoExtended.variable} ${cinzelDecorative.variable} antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn-uicons.flaticon.com/2.1.0/uicons-regular-rounded/css/uicons-regular-rounded.css"
        />
        {/* Material Symbols is an icon font and is not available through next/font. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional"
        />
        {hasLicensedFonts ? (
          // Local preview of trial / personal-use fonts; deliberately outside the bundle and Git.
          // eslint-disable-next-line @next/next/no-css-tags
          <link rel="stylesheet" href="/fonts/licensed/fonts.css" />
        ) : null}
      </head>
      <body className="flex min-h-dvh w-full min-w-0 flex-col overflow-x-clip">
        <ThemeProvider>
          <SkipLink />
          <PanelChrome>
            <GlobalBackground />
            <GlobalHeader />
            <RouteTransition />
          </PanelChrome>
          {children}
          <PanelChrome>
            <Footer />
            <Chatbot />
          </PanelChrome>
        </ThemeProvider>
      </body>
    </html>
  );
}
