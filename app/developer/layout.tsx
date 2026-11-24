import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { assertDeveloperGate } from '@/lib/developer/security';

export const metadata: Metadata = {
  title: 'Developer Command Center | Zion',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function DeveloperLayout({ children }: { children: React.ReactNode }) {
  try {
    assertDeveloperGate(await headers());
  } catch {
    notFound();
  }
  return children;
}
