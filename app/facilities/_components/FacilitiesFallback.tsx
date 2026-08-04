import FacilitiesShowcase from '@/components/client/FacilitiesShowcase';
import PublicSubpageShell from '@/components/client/PublicSubpageShell';

export default function FacilitiesFallback() {
  return (
    <PublicSubpageShell heroKey="facilities">
      <FacilitiesShowcase />
    </PublicSubpageShell>
  );
}
