import type { Metadata, Viewport } from 'next';
import './globals.css';
import '@/styles/primitives.css';

import GlobalBackground from '@/components/layout/GlobalBackground';
import GlobalHeader from '@/components/layout/GlobalHeader';
import Footer from '@/components/layout/Footer';
import { BRAND } from '@/config/brand';
import { ThemeProvider } from './_providers/ThemeProvider';
import PanelChrome from '@/components/layout/PanelChrome';
import SkipLink from '@/components/layout/SkipLink';
import { alexBrush, inter, playfair } from './_fonts';
import Chatbot from '@/components/chatbot/Chatbot';

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EAE6D1' },
    { media: '(prefers-color-scheme: dark)', color: '#0C100B' },
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
      className={`${inter.variable} ${playfair.variable} ${alexBrush.variable} antialiased`}
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
      </head>
      <body className="flex min-h-dvh w-full min-w-0 flex-col overflow-x-clip">
        <ThemeProvider>
          <SkipLink />
          <PanelChrome>
            <GlobalBackground />
            <GlobalHeader />
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
