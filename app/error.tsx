'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/shared/Button';

export default function ApplicationError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('A public application route failed to render.', error);
  }, [error]);

  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-6 py-24">
      <section
        aria-labelledby="application-error-title"
        className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white/95 p-8 text-center shadow-xl"
      >
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">
          Temporary interruption
        </p>
        <h1
          id="application-error-title"
          className="mt-3 font-serif text-3xl font-semibold text-[var(--palette-night-subtle)]"
        >
          This page could not finish loading
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Your submitted information remains protected. Try the request again, or return to the home
          page if the problem continues.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-gray-500">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button type="button" variant="primary" onClick={() => unstable_retry()}>
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary">
            Return home
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
