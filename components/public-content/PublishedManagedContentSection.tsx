import type { ContentType } from '@prisma/client';
import { listPublishedContent } from '@/services/public-content/content.service';
import StructuredContentRenderer from './StructuredContentRenderer';

export type ManagedPublicContentType = 'ABOUT' | 'CONTACT';

const MANAGED_PUBLIC_CONTENT_TYPES = new Set<ManagedPublicContentType>(['ABOUT', 'CONTACT']);

function isManagedPublicContentType(value: unknown): value is ManagedPublicContentType {
  return (
    typeof value === 'string' && MANAGED_PUBLIC_CONTENT_TYPES.has(value as ManagedPublicContentType)
  );
}

export default async function PublishedManagedContentSection({
  type,
  label,
}: {
  type: ManagedPublicContentType;
  label: string;
}) {
  // Managed content is supplementary to these public pages. During a staged
  // schema rollout, an older generated client or database may not know the new
  // enum values yet; that must never make the page unavailable.
  if (!isManagedPublicContentType(type)) return null;

  let items: Awaited<ReturnType<typeof listPublishedContent>>;
  try {
    items = await listPublishedContent(type as ContentType);
  } catch {
    console.warn(
      `[public-content] Optional ${type} content is unavailable; rendering the page fallback.`,
    );
    return null;
  }

  if (!items.length) return null;

  return (
    <section
      aria-label={label}
      className="relative z-10 w-full bg-[var(--palette-gold-soft)]/75 px-4 py-12 md:px-8 md:py-16"
    >
      <div className="mx-auto max-w-5xl space-y-12">
        {items.map((item) => (
          <div
            id={`${type.toLowerCase()}-${item.slug}`}
            key={item.id}
            className="scroll-mt-28 rounded-3xl border border-zion-accent/20 bg-surface/75 p-6 shadow-sm md:p-10"
          >
            <StructuredContentRenderer type={item.type} payload={item.version?.payload} />
          </div>
        ))}
      </div>
    </section>
  );
}
