import 'server-only';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { faqPageEntries, publicFaqs } from '@/config/public-faqs';
import {
  backupPackageSources,
  packageSourcePaths,
  websiteChatSources,
  publicEventSources,
} from '@/config/chatbot';
import type { PublicFaq, ChatSource } from '@/lib/chatbot/types';
import type { PublicSystemSettings } from '@/lib/system-settings-types';

export async function publishedVisitorFaqs(): Promise<PublicFaq[]> {
  const rows = await prisma.$queryRaw<PublicFaq[]>`
    SELECT e.id, v.question, v.answer, v.tags
    FROM support_faq_entries e
    JOIN support_faq_versions v ON v.id=e.current_published_version_id AND v.faq_entry_id=e.id
    LEFT JOIN support_categories c ON c.id=e.category_id
    WHERE e.status NOT IN ('hidden','archived')
      AND v.publication_status='PUBLISHED' AND v.client_visible=true
      AND v.published_at<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      AND (v.expires_at IS NULL OR v.expires_at>(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
      AND v.question IS NOT NULL AND v.answer IS NOT NULL
      AND (e.category_id IS NULL OR (c.status='active' AND c.client_visible=true))
    ORDER BY e.id LIMIT 501
  `;
  if (rows.length > 500) throw new Error('Public FAQ source limit exceeded.');
  // Once managed FAQs exist they replace the static fallback, so hiding managed
  // answers cannot accidentally republish an older fallback on the same subject.
  const managed = await prisma.supportFaqEntry.count();
  return managed ? rows : publicFaqs;
}

const packageSnapshot = z.object({
  packageName: z.string().trim().min(1),
  description: z.string().nullish(),
  price: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  paxIncluded: z.number().int().nonnegative(),
  inclusions: z
    .array(
      z.object({
        inclusionName: z.string().optional(),
        name: z.string().optional(),
        description: z.string().nullish(),
        isOptional: z.boolean().optional(),
      }),
    )
    .optional(),
});

export async function visitorSources(settings: PublicSystemSettings): Promise<ChatSource[]> {
  if (settings.client.maintenanceMode) return [];
  const [faqs, packages, managedPackages, policy] = await Promise.all([
    settings.client.faqVisible ? publishedVisitorFaqs() : [],
    settings.client.packagesVisible
      ? prisma.$queryRaw<
          Array<{
            id: string;
            serviceId: string;
            revision: number;
            category: string;
            categorySlug: string;
            snapshot: unknown;
          }>
        >`
      SELECT p.id, p.event_category_id AS "serviceId", p.current_version AS revision, c.name AS category, c.slug AS "categorySlug", v.snapshot_data AS snapshot
      FROM packages p JOIN event_categories c ON c.id=p.event_category_id
      JOIN package_versions v ON v.package_id=p.id AND v.version_number=p.current_version
      WHERE p.status='active' AND p.client_visible=true AND c.status='active' AND c.client_visible=true
      ORDER BY p.id LIMIT 501
    `
      : [],
    settings.client.packagesVisible ? prisma.package.count() : 0,
    prisma.adminPolicy.findUnique({
      where: { id: 'venue' },
      select: { reviewed: true, paymentRule: true, version: true },
    }),
  ]);
  if (packages.length > 500) throw new Error('Public package source limit exceeded.');
  const seenFaqQuestions = new Set(faqs.map((faq) => faq.question.trim().toLowerCase()));
  const backupFaqPageSources: ChatSource[] = settings.client.faqVisible
    ? faqPageEntries
        .filter((faq) => !seenFaqQuestions.has(faq.question.trim().toLowerCase()))
        .map((faq): ChatSource => ({
          id: faq.id,
          kind: 'faq',
          title: faq.question,
          text: faq.answer,
          href: `/faq#${encodeURIComponent(faq.id)}`,
          keywords: faq.tags ?? [],
        }))
    : [];
  const sources: ChatSource[] = [
    ...websiteChatSources,
    ...(settings.client.packagesVisible ? publicEventSources : []),
    ...backupFaqPageSources,
    ...(policy?.reviewed &&
    ['DEPOSIT_REQUIRED', 'FULL_PAYMENT_REQUIRED', 'NO_PAYMENT_REQUIRED'].includes(
      policy.paymentRule,
    )
      ? [
          {
            id: 'reviewed-payment-rule',
            kind: 'policy' as const,
            title: 'Reviewed booking payment requirement',
            href: '/contact',
            text:
              policy.paymentRule === 'DEPOSIT_REQUIRED'
                ? 'The reviewed booking policy requires a deposit before staff confirmation. The amount and applicable package terms must be verified with the Zion team.'
                : policy.paymentRule === 'FULL_PAYMENT_REQUIRED'
                  ? 'The reviewed booking policy requires full payment before staff confirmation. The amount and applicable package terms must be verified with the Zion team.'
                  : 'The reviewed booking policy does not require payment before staff confirmation. The Zion team must still verify the request and applicable terms.',
            keywords: ['deposit', 'payment', 'requirement'],
            revision: String(policy.version),
          },
        ]
      : []),
    ...faqs.map((faq): ChatSource => ({
      id: faq.id,
      kind: 'faq',
      title: faq.question,
      text: faq.answer,
      href: `/faq#${encodeURIComponent(faq.id)}`,
      keywords: faq.tags ?? [],
    })),
    ...(settings.client.packagesVisible && managedPackages === 0 ? backupPackageSources : []),
    ...packages.map((row): ChatSource => {
      // Only the version currently published to visitors is eligible. Never read
      // live draft prices, internal notes, contract fields, or staff records.
      const snapshot = packageSnapshot.parse(row.snapshot);
      const price = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: snapshot.currency,
      }).format(snapshot.price);
      const inclusions = (snapshot.inclusions ?? [])
        .map(
          (item) =>
            `${item.inclusionName ?? item.name ?? ''}${item.isOptional ? ' (optional)' : ''}${item.description ? `: ${item.description}` : ''}`,
        )
        .filter(Boolean);
      return {
        id: row.id,
        kind: 'package',
        revision: String(row.revision),
        offering: {
          serviceId: row.serviceId,
          category: row.category,
          packageName: snapshot.packageName,
          price: snapshot.price,
          currency: snapshot.currency,
          guests: snapshot.paxIncluded,
        },
        title: `${row.category} — ${snapshot.packageName}`,
        text: [
          `Published package price: ${price}`,
          `Guests included: ${snapshot.paxIncluded}`,
          snapshot.description,
          inclusions.length ? `Inclusions:\n${inclusions.join('\n')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        href: packageSourcePaths[row.categorySlug] ?? '/contact',
        keywords: ['package', 'price', 'inclusion', row.category],
      };
    }),
  ];
  return sources.map((source) => ({
    ...source,
    revision: createHash('sha256')
      .update(JSON.stringify([source.title, source.text, source.offering, source.revision]))
      .digest('hex')
      .slice(0, 16),
  }));
}
