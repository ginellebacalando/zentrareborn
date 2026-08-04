import PublicSubpageShell from '@/components/client/PublicSubpageShell';
import PoliciesClient from './_components/PoliciesClient';

export const dynamic = 'force-dynamic';

export default function PoliciesPage() {
  return (
    <PublicSubpageShell heroKey="rules">
      <PoliciesClient />
    </PublicSubpageShell>
  );
}
