import Link from 'next/link';

export default function ClientFeatureUnavailable({
  title = 'Temporarily Unavailable',
  message,
  actionLabel = 'Contact Zion',
  actionHref = '/contact',
}: {
  title?: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <section className="relative z-10 flex min-h-[420px] w-full items-center justify-center bg-[var(--palette-gold-soft)] px-4 py-20">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-zion-accent/25 bg-surface px-6 py-10 text-center shadow-[0_20px_60px_color-mix(in_srgb,var(--palette-night)_8%,transparent)] md:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent-ink">
          Zion Events Place
        </p>
        <h2 className="mt-3 font-sahitya text-4xl font-bold text-ink">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl font-serif text-lg leading-8 text-muted">{message}</p>
        <Link
          href={actionHref}
          className="mt-8 inline-flex rounded-full bg-[var(--palette-night-subtle)] px-7 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:bg-zion-accent hover:text-ink"
        >
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}
