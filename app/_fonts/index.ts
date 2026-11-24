import localFont from 'next/font/local';

export const inter = localFont({
  src: './inter.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
  fallback: ['Segoe UI', 'Arial'],
});

export const playfair = localFont({
  src: [
    { path: './playfair-display.woff2', weight: '400 900', style: 'normal' },
    { path: './playfair-display-italic.woff2', weight: '400 900', style: 'italic' },
  ],
  variable: '--font-playfair',
  display: 'swap',
  fallback: ['Georgia'],
});

export const alexBrush = localFont({
  src: './alex-brush.woff2',
  variable: '--font-alex-brush',
  weight: '400',
  display: 'swap',
  preload: false,
  fallback: ['Segoe Script', 'cursive'],
});
