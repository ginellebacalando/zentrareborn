import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { currentDeveloper } from '@/lib/developer/auth';
import { DeveloperError } from '@/lib/developer/security';
import DeveloperWorkspace from '@/components/developer/DeveloperWorkspace';
import { localDeveloperAccessForRequest } from '@/lib/developer/local-access';

export default async function DeveloperPage() {
  let actor;
  const requestHeaders = await headers();
  const localAccess = localDeveloperAccessForRequest(requestHeaders);
  try {
    actor = await currentDeveloper(requestHeaders);
  } catch (error) {
    if (error instanceof DeveloperError && error.status === 404) notFound();
    throw error;
  }
  if (!actor && !localAccess) redirect('/developer/access');
  return (
    <DeveloperWorkspace
      temporaryAccessUntil={localAccess ? new Date(localAccess.expiresAt).toISOString() : undefined}
    />
  );
}
