import Link from 'next/link';

export default function CollectionPolicyPage() {
  return (
    <main className="page-shell" style={{ maxWidth: 820 }}>
      <div className="eyebrow">Policies</div>
      <h1 style={{ marginTop: 10 }}>Warehouse Collection Policy</h1>
      <p style={{ color: 'var(--muted)', marginTop: 12, lineHeight: 1.65 }}>
        AmericanHomes operates warehouse collection only from our Tema warehouse
        facility. Orders and approved reservations are not dispatched via
        platform-managed home delivery.
      </p>

      <section className="acct-panel" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>1. Pickup location &amp; hours</h2>
        <p style={{ color: 'var(--ink-body)', fontSize: 13.5, lineHeight: 1.65 }}>
          Community 25, Tema · Monday – Saturday, 9:00 AM – 6:00 PM.
          Collection is available once your order status reads{' '}
          <strong>Ready for collection</strong>.
        </p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>2. Payment before collection</h2>
        <p style={{ color: 'var(--ink-body)', fontSize: 13.5, lineHeight: 1.65 }}>
          Approved reservations hold shared available stock for a 48-hour payment
          window. Full or agreed payment must be verified before items are
          released at the warehouse.
        </p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>3. Partial collection</h2>
        <p style={{ color: 'var(--ink-body)', fontSize: 13.5, lineHeight: 1.65 }}>
          Multi-item orders support partial collection. Only the exact quantity
          physically handed over is recorded on your collection receipt, and the
          order remains open until all items are collected.
        </p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>4. Authorised representatives</h2>
        <p style={{ color: 'var(--ink-body)', fontSize: 13.5, lineHeight: 1.65, marginBottom: 0 }}>
          If someone collects on your behalf, their full legal name and national
          identity reference must be recorded along with your authorisation at
          handover.
        </p>
      </section>

      <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
        <Link href="/shop" className="button primary">
          Browse catalogue
        </Link>
        <Link href="/policies/returns" className="button">
          Returns &amp; exchanges policy
        </Link>
      </div>
    </main>
  );
}
