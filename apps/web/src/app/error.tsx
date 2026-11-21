'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page-shell" style={{ textAlign: 'center', paddingTop: 100 }}>
      <h1>Something went wrong</h1>
      <p style={{ color: 'var(--muted)', margin: '14px 0 24px' }}>{error.message}</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
