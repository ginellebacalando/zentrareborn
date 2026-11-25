import { faqPageEntries, zeniExtraFaqs } from '@/config/public-faqs';
import type { ChatSource, PublicFaq } from './types';

/** An FAQ as a Zeni source. Zeni speaks in the casual wording Zion approved when there is one. */
export function faqChatSource(
  faq: PublicFaq,
  href = `/faq#${encodeURIComponent(faq.id)}`,
): ChatSource {
  return {
    id: faq.id,
    kind: 'faq',
    title: faq.question,
    text: faq.chatAnswer ?? faq.answer,
    href,
    keywords: faq.tags ?? [],
    ...(faq.topic ? { topic: faq.topic } : {}),
  };
}

/**
 * Zion's official FAQ answers: the /faq page entries plus Zeni-only follow-up questions from the
 * same documents, without questions another FAQ (managed or built-in) already answers.
 */
export function officialFaqSources(coveredQuestions: ReadonlySet<string> = new Set()) {
  return [
    ...faqPageEntries.map((faq) => faqChatSource(faq)),
    ...zeniExtraFaqs.map((faq) => faqChatSource(faq, '/faq')),
  ].filter((source) => !coveredQuestions.has(source.title.trim().toLowerCase()));
}
