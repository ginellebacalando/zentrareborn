import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Frame-Options', value: 'DENY' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  // Keep isolated verification from locking or overwriting the user's dev cache.
  distDir:
    process.env.CHATBOT_ISOLATED_PREVIEW === '1'
      ? '.next/chatbot-preview'
      : process.env.DEVELOPER_ISOLATED_PREVIEW === '1'
        ? '.next/developer-preview'
        : process.env.ADMIN_ISOLATED_PREVIEW === '1'
          ? '.next/admin-preview'
          : '.next',
  devIndicators: false,
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.storage.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '/w20/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  // The receipt PDF reads the ZENTRA wordmark image from disk (lib/payment-receipts.ts), so both
  // receipt routes carry the file when deployed.
  outputFileTracingIncludes: {
    '/api/admin/receipts/*': ['./public/images/brand/zentra-wordmark.png'],
    '/booking/pay/*/receipts/*': ['./public/images/brand/zentra-wordmark.png'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      ...['/developer/:path*', '/api/developer/:path*'].map((source) => ({
        source,
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        ],
      })),
      // A client's private payment page and its receipts: the signed link is never indexed or sent
      // on as a referrer.
      ...['/booking/pay/:token', '/booking/pay/:token/:path*'].map((source) => ({
        source,
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      })),
      // Payment screenshots come from the public and receipts are downloads, so even opened
      // directly they stay inert, sandboxed documents. Listed after the site-wide rule, which they
      // replace for this header.
      ...[
        '/api/admin/payment-proofs/:id',
        '/api/admin/receipts/:id',
        '/booking/pay/:token/receipts/:paymentId',
      ].map((source) => ({
        source,
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; img-src 'self'; sandbox" },
        ],
      })),
    ];
  },
};

export default nextConfig;
