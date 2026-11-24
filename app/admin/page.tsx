import type { Metadata } from 'next';
import LoginForm from '@/components/admin/LoginForm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin/access';
import { localAdminAutoLoginToken } from '@/lib/admin/local-access';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await currentAdmin()) redirect('/admin/dashboard');
  const query = await searchParams;
  const token = query['signed-out'] === '1' ? null : localAdminAutoLoginToken(await headers());
  return <LoginForm localAccessToken={token} />;
}
