import 'server-only';
import { prisma } from '@/lib/prisma';
import { publicFacilities } from '@/config/public-facilities';
import { bookletChatSources, websiteChatSources } from '@/config/chatbot';
import { officialFaqSources } from '@/lib/chatbot/faq-sources';
import type { ZeniAdminOverview, ZeniKnowledgeSummary } from '@/lib/chatbot/admin-types';
import { publishedVisitorFaqs } from './sources';
import { sharedZeniLlmGuard, zeniLlmSettings } from './gemini';
import { listOpenZeniGaps } from './gaps';
import { ZENI_INQUIRY_SOURCE } from './escalation';

const iso = (value: Date | null | undefined) => (value ? new Date(value).toISOString() : null);

async function packageKnowledge(): Promise<ZeniKnowledgeSummary> {
  const [published, managed] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number; updated: Date | null }>>`
      SELECT count(*)::int AS count, max(greatest(v.created_at, p.updated_at)) AS updated
      FROM packages p JOIN event_categories c ON c.id=p.event_category_id
      JOIN package_versions v ON v.package_id=p.id AND v.version_number=p.current_version
      WHERE p.status='active' AND p.client_visible=true AND c.status='active' AND c.client_visible=true
    `,
    prisma.package.count(),
  ]);
  const count = Number(published[0]?.count ?? 0);
  return {
    id: 'packages',
    label: 'Packages',
    count,
    updatedAt: iso(published[0]?.updated),
    note:
      managed === 0
        ? 'No packages are published yet, so Zeni uses the built-in package summaries without “starts at” prices on cards.'
        : 'Only the published version of each visible package is used. Prices on cards come from that version.',
    edit: { label: 'Edit in Services & packages', href: '/admin/services' },
  };
}

async function faqKnowledge(): Promise<ZeniKnowledgeSummary> {
  const [faqs, managed, latest] = await Promise.all([
    publishedVisitorFaqs(),
    prisma.supportFaqEntry.count(),
    prisma.supportFaqVersion.findFirst({
      where: { publicationStatus: 'PUBLISHED', publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    }),
  ]);
  // Zeni also answers from Zion's official FAQ documents (the /faq page and its follow-ups),
  // except where a managed or built-in answer has the same question (services/chatbot/sources.ts).
  const seen = new Set(faqs.map((faq) => faq.question.trim().toLowerCase()));
  const official = officialFaqSources(seen).length;
  return {
    id: 'faqs',
    label: 'FAQs',
    count: faqs.length + official,
    updatedAt: managed ? iso(latest?.publishedAt) : null,
    note: managed
      ? `Published, visible and current FAQ versions come first, plus ${official} answers from Zion’s official FAQ documents.`
      : `No managed FAQs exist yet, so Zeni uses ${official} answers from Zion’s official FAQ documents and ${faqs.length} built-in answers.`,
    edit: { label: 'Published from the Developer workspace (FAQ control center)' },
  };
}

async function policyKnowledge(): Promise<ZeniKnowledgeSummary> {
  const policy = await prisma.adminPolicy.findUnique({
    where: { id: 'venue' },
    select: { reviewed: true, version: true, updatedAt: true },
  });
  const sections = websiteChatSources.filter((source) => source.kind === 'policy').length;
  return {
    id: 'policies',
    label: 'Policies & terms',
    count: sections + (policy?.reviewed ? 1 : 0),
    updatedAt: iso(policy?.updatedAt),
    note: policy?.reviewed
      ? `Published policy and terms pages, plus the reviewed payment requirement (policy v${policy.version}).`
      : 'Published policy and terms pages. The payment requirement is used only after a super administrator marks the venue policy reviewed.',
    edit: { label: 'Venue policy in Settings', href: '/admin/settings' },
  };
}

function bookletKnowledge(): ZeniKnowledgeSummary {
  const packages = new Set(bookletChatSources.map((source) => source.packageName));
  return {
    id: 'booklets',
    label: 'Package booklets',
    count: packages.size,
    updatedAt: null,
    note: 'Menus, inclusions and conditions from the booklets on the event pages. Prices come from Packages, which match the booklets’ published rates.',
    edit: { label: 'Site content (developer change)' },
  };
}

function facilityKnowledge(): ZeniKnowledgeSummary {
  return {
    id: 'facilities',
    label: 'Facilities',
    count: publicFacilities.length,
    updatedAt: null,
    note: 'Descriptions and photos shared with the public Facilities page.',
    edit: { label: 'Site content (developer change)' },
  };
}

async function handoffCounts(): Promise<ZeniAdminOverview['handoffs']> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, last30Days, open] = await Promise.all([
      prisma.inquiry.count({ where: { sourcePage: ZENI_INQUIRY_SOURCE } }),
      prisma.inquiry.count({
        where: { sourcePage: ZENI_INQUIRY_SOURCE, submittedAt: { gte: since } },
      }),
      prisma.inquiry.count({ where: { sourcePage: ZENI_INQUIRY_SOURCE, status: 'NEW' } }),
    ]);
    return { available: true, total, last30Days, open };
  } catch {
    console.error('[zeni] Hand-off counts are unavailable.');
    return { available: false, total: 0, last30Days: 0, open: 0 };
  }
}

/** Everything the admin Zeni page shows. No visitor conversation or contact detail is read. */
export async function zeniAdminOverview(): Promise<ZeniAdminOverview> {
  const settings = zeniLlmSettings();
  const [packages, faqs, policies, gaps, handoffs] = await Promise.all([
    packageKnowledge(),
    faqKnowledge(),
    policyKnowledge(),
    listOpenZeniGaps(50),
    handoffCounts(),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    ai: {
      enabled: settings.enabled,
      keyConfigured: settings.keyConfigured,
      model: settings.model,
      switchValue: settings.switchValue,
      ...(settings.reason ? { reason: settings.reason } : {}),
      usage: sharedZeniLlmGuard().snapshot(),
    },
    knowledge: [packages, bookletKnowledge(), faqs, facilityKnowledge(), policies],
    gaps,
    handoffs,
  };
}
