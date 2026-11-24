'use client';
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>Admin workspace unavailable</h1>
      <p>
        Check the database connection and administrator authentication configuration. No client data
        was changed.
      </p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
