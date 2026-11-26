/* eslint-disable @next/next/no-img-element -- Published content may reference approved external media hosts that are not known at build time. */
import React from 'react';
import { ButtonAnchor } from '@/components/shared/Button';

type PolicyBlock = {
  type?: string;
  level?: number;
  text?: string;
  ordered?: boolean;
  items?: string[];
  label?: string;
  href?: string;
  anchor?: string;
};

function values(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function PolicyBlocksRenderer({ payload }: { payload: unknown }) {
  const document = values(payload);
  const blocks = Array.isArray(document.blocks) ? (document.blocks as PolicyBlock[]) : [];

  return (
    <article className="mx-auto max-w-4xl text-ink dark:text-[var(--palette-pearl)]">
      <header className="mb-8 border-b border-zion-accent/25 pb-6">
        <h1 className="font-sahitya text-4xl font-bold">{stringValue(document.title)}</h1>
        {document.summary ? (
          <p className="mt-3 text-base leading-7 text-gray-600 dark:text-[var(--palette-sage)]">
            {stringValue(document.summary)}
          </p>
        ) : null}
        {document.effectiveDate ? (
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">
            Effective {stringValue(document.effectiveDate)}
          </p>
        ) : null}
      </header>
      <div className="space-y-5">
        {blocks.map((block, index) => {
          if (block.type === 'heading') {
            const Heading = block.level === 4 ? 'h4' : block.level === 3 ? 'h3' : 'h2';
            return (
              <Heading
                id={block.anchor}
                key={index}
                className="scroll-mt-28 pt-3 font-sahitya text-2xl font-bold"
              >
                {block.text}
              </Heading>
            );
          }
          if (block.type === 'paragraph') {
            return (
              <p
                key={index}
                className="max-w-[70ch] whitespace-pre-line text-base leading-8 text-gray-700 dark:text-[var(--palette-divider)]"
              >
                {block.text}
              </p>
            );
          }
          if (block.type === 'callout') {
            return (
              <aside
                key={index}
                className="rounded-2xl border border-zion-accent/30 bg-[var(--palette-gold-soft)]/45 p-5 leading-7 dark:bg-zion-accent/10"
              >
                {block.text}
              </aside>
            );
          }
          if (block.type === 'list') {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List
                key={index}
                className={`max-w-[70ch] space-y-2 pl-6 leading-7 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
              >
                {stringList(block.items).map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </List>
            );
          }
          if (block.type === 'link' && block.href) {
            return (
              <p key={index}>
                <a
                  href={block.href}
                  className="font-bold text-accent-ink underline decoration-[var(--palette-gold-hover)]/50 underline-offset-4"
                >
                  {block.label || block.href}
                </a>
              </p>
            );
          }
          return null;
        })}
      </div>
    </article>
  );
}

export default function StructuredContentRenderer({
  type,
  payload,
}: {
  type: string;
  payload: unknown;
}) {
  const value = values(payload);

  if (type === 'GALLERY_ITEM') {
    const imageUrl = stringValue(value.imageUrl);
    return (
      <figure className="overflow-hidden rounded-2xl border border-zion-accent/20 bg-surface shadow-sm dark:bg-surface/5">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={stringValue(value.altText)}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-[var(--palette-gold-soft)] text-sm font-bold text-accent-ink dark:bg-surface/5">
            Approved media preview
          </div>
        )}
        <figcaption className="p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-sahitya text-2xl font-bold">{stringValue(value.title)}</h2>
            {value.featured ? (
              <span className="rounded-full bg-[var(--palette-gold-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-ink">
                Featured
              </span>
            ) : null}
          </div>
          {value.caption ? (
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-[var(--palette-sage)]">
              {stringValue(value.caption)}
            </p>
          ) : null}
        </figcaption>
      </figure>
    );
  }

  if (type === 'FACILITY') {
    const images = stringList(value.imageUrls);
    const cta = values(value.cta);
    return (
      <article
        id={`facility-${stringValue(value.slug)}`}
        className="scroll-mt-28 overflow-hidden rounded-2xl border border-zion-accent/20 bg-surface shadow-sm dark:bg-surface/5"
      >
        {images[0] ? (
          <img
            src={images[0]}
            alt={stringValue(value.name)}
            className="aspect-[16/7] w-full object-cover"
          />
        ) : null}
        <div className="p-6">
          <h2 className="font-sahitya text-3xl font-bold">{stringValue(value.name)}</h2>
          <p className="mt-2 text-base font-semibold text-accent-ink">
            {stringValue(value.summary)}
          </p>
          <p className="mt-4 whitespace-pre-line leading-7 text-gray-700 dark:text-[var(--palette-divider)]">
            {stringValue(value.description)}
          </p>
          {stringList(value.amenities).length ? (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {stringList(value.amenities).map((amenity) => (
                <li
                  key={amenity}
                  className="rounded-xl bg-[var(--palette-gold-soft)]/45 px-4 py-2 text-sm font-semibold"
                >
                  {amenity}
                </li>
              ))}
            </ul>
          ) : null}
          {value.accessibilityGuidance ? (
            <aside className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              {stringValue(value.accessibilityGuidance)}
            </aside>
          ) : null}
          {cta.href ? (
            <ButtonAnchor href={stringValue(cta.href)} variant="primary" className="mt-6">
              {stringValue(cta.label) || 'Learn more'}
            </ButtonAnchor>
          ) : null}
        </div>
      </article>
    );
  }

  return <PolicyBlocksRenderer payload={payload} />;
}
