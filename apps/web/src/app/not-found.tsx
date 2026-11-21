import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page-shell" style={{ textAlign: 'center', paddingTop: 100 }}>
      <h1>Page not found</h1>
      <p style={{ color: 'var(--muted)', margin: '14px 0 24px' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="button primary">
        Return to storefront
      </Link>
    </main>
  );
}
