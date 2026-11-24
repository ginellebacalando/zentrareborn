import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-6 py-24">
      <section className="w-full max-w-xl rounded-3xl border border-[var(--palette-night-subtle)]/10 bg-white/95 p-8 text-center shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">404</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-[var(--palette-night-subtle)]">
          We could not find that page
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          The link may have changed or the record is no longer available.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-[var(--palette-night-subtle)] px-5 py-3 text-sm font-semibold text-[var(--palette-gold-soft)] transition hover:bg-[var(--palette-night-raised)]"
          >
            Return home
          </Link>
          <Link
            href="/contact"
            className="rounded-xl border border-[var(--palette-night-subtle)]/20 bg-white px-5 py-3 text-sm font-semibold text-[var(--palette-night-subtle)] transition hover:bg-[var(--palette-pearl)]"
          >
            Contact our team
          </Link>
        </div>
      </section>
    </main>
  );
}
