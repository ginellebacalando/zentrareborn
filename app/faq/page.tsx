import { connection } from 'next/server';
import PublicSubpageShell from '@/components/client/PublicSubpageShell';
import ClientFeatureUnavailable from '@/components/client/ClientFeatureUnavailable';
import { faqPageEntries } from '@/config/public-faqs';
import { prisma } from '@/lib/prisma';
import { getClientFeatureAvailability } from '@/lib/system-settings';
import FAQClient from './_components/FAQClient';
import { publishedVisitorFaqs } from '@/services/chatbot/sources';

export default async function FAQPage() {
  await connection();
  const faqAvailability = await getClientFeatureAvailability('faq');
  const managedCount = faqAvailability.enabled ? await prisma.supportFaqEntry.count() : 0;
  const faqs = faqAvailability.enabled
    ? managedCount > 0
      ? await publishedVisitorFaqs()
      : faqPageEntries
    : [];

  return (
    <PublicSubpageShell heroKey="faq">
      {faqAvailability.enabled ? (
        <FAQClient faqs={faqs} />
      ) : (
        <ClientFeatureUnavailable title="FAQ Is Paused" message={faqAvailability.message} />
      )}
    </PublicSubpageShell>
  );
}
