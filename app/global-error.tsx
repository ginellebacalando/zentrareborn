'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('The application root failed to render.', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          alignItems: 'center',
          background: '#f4f0df',
          color: '#1a1f18',
          display: 'flex',
          fontFamily: 'system-ui, sans-serif',
          justifyContent: 'center',
          margin: 0,
          minHeight: '100vh',
          padding: '24px',
        }}
      >
        <main
          style={{
            background: '#fff',
            border: '1px solid #e5d8aa',
            borderRadius: '24px',
            boxShadow: '0 20px 50px rgba(26, 31, 24, 0.12)',
            maxWidth: '560px',
            padding: '40px',
            textAlign: 'center',
            width: '100%',
          }}
        >
          <title>Temporary interruption | Zion Events Place</title>
          <h1 style={{ fontFamily: 'Georgia, serif', margin: 0 }}>
            Zion is temporarily unavailable
          </h1>
          <p style={{ color: '#5f665c', lineHeight: 1.65, margin: '16px 0 0' }}>
            The system protected your request but could not finish loading the page. Please try
            again in a moment.
          </p>
          {error.digest ? (
            <p style={{ color: '#526255', fontSize: '12px' }}>Reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              background: '#1a1f18',
              border: 0,
              borderRadius: '12px',
              color: '#fdf5cc',
              cursor: 'pointer',
              fontWeight: 700,
              marginTop: '24px',
              padding: '12px 20px',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
