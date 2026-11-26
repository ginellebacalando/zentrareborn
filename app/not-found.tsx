import { ButtonLink } from '@/components/shared/Button';

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
          <ButtonLink href="/" variant="primary">
            Return home
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Contact our team
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
