import Link from 'next/link';

export default function ReturnsPolicyPage() {
  return (
    <main className="page-shell" style={{ maxWidth: 820 }}>
      <div className="eyebrow">Policies</div>
      <h1 style={{ marginTop: 10 }}>Returns &amp; Exchanges Policy</h1>
      <p style={{ color: 'var(--muted)', marginTop: 12, lineHeight: 1.65 }}>
        Every item imported by AmericanHomes is physically inspected, cleaned,
        photographed, and documented prior to publication. Return and exchange
        requests are reviewed against those pre-sale inspection records.
      </p>

      <section className="acct-panel" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>1. Seven-day return window</h2>
        <p style={{ color: 'var(--ink-body)', fontSize: 13.5, lineHeight: 1.65 }}>
          Return or exchange requests must be submitted within{' '}
          <strong>7 days</strong> of collection against the original order
          reference. Requests outside the 7-day window require an authorised
          management exception.
        </p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>2. Disclosed defects &amp; new issues</h2>
        <p style={{ color: 'var(--ink-body)', fontSize: 13.5, lineHeight: 1.65 }}>
          Any condition note or defect explicitly disclosed on the product
          listing before purchase is excluded as a return basis. Newly
          discovered functional or structural defects qualify for inspection and
          review.
        </p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>3. Inspection &amp; disposition</h2>
        <p style={{ color: 'var(--ink-body)', fontSize: 13.5, lineHeight: 1.65 }}>
          Returned items are placed in an unavailable quarantine state until
          physical re-inspection is completed. Refunds, exchanges (with price
          difference settlement where applicable), or store credit require
          management approval.
        </p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>4. How to submit a request</h2>
        <p style={{ color: 'var(--ink-body)', fontSize: 13.5, lineHeight: 1.65, marginBottom: 0 }}>
          Sign in to your{' '}
          <Link href="/account/orders" style={{ color: 'var(--green)', fontWeight: 700 }}>
            My Orders
          </Link>{' '}
          page and select <strong>Request return / exchange</strong> on the
          collected order.
        </p>
      </section>

      <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
        <Link href="/account/orders" className="button primary">
          View my orders
        </Link>
        <Link href="/policies/collection" className="button">
          Warehouse collection policy
        </Link>
      </div>
    </main>
  );
}
