import PublicSubpageShell from '@/components/client/PublicSubpageShell';
import TermsClient from './_components/TermsClient';

export const dynamic = 'force-dynamic';

export default function TermsPage() {
  return (
    <PublicSubpageShell heroKey="terms">
      <TermsClient />
    </PublicSubpageShell>
  );
}
