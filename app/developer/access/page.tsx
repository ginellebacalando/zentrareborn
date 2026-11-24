import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { currentDeveloper } from '@/lib/developer/auth';
import { DeveloperError } from '@/lib/developer/security';
import DeveloperLogin from '@/components/developer/DeveloperLogin';
import { localDeveloperAccessForRequest } from '@/lib/developer/local-access';

export default async function DeveloperAccess() {
  let actor;
  const requestHeaders = await headers();
  if (localDeveloperAccessForRequest(requestHeaders)) redirect('/developer');
  try {
    actor = await currentDeveloper(requestHeaders);
  } catch (error) {
    if (error instanceof DeveloperError && error.status === 404) notFound();
    throw error;
  }
  if (actor) redirect('/developer');
  return <DeveloperLogin />;
}
