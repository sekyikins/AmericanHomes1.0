'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Completing sign-in…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    const safeNext =
      next && next.startsWith('/') && !next.startsWith('//')
        ? next
        : '/account';

    const timer = setTimeout(() => {
      setStatus('Verified. Redirecting…');
      router.replace(safeNext);
    }, 600);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main
      className="page-shell"
      style={{
        minHeight: '70vh',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
      }}
    >
      <div className="acct-panel" style={{ maxWidth: 420, width: '100%', padding: 32 }}>
        <div className="eyebrow">Authentication</div>
        <h1 style={{ fontSize: 22, marginTop: 8 }}>{status}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
          If you are not redirected automatically, choose where to continue.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
          <Link href="/account" className="button primary">
            Customer account
          </Link>
          <Link href="/" className="button">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
