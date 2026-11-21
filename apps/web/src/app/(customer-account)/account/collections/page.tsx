'use client';

import { ArrowLeft, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { ordersApi } from '@/lib/api';
import { mapCustomerOrders, type CustomerCollectionItem } from '@/lib/customerAccount';

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CustomerCollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orders = mapCustomerOrders(await ordersApi.getMy());
      const rows: CustomerCollectionItem[] = [];
      for (const ord of orders) {
        if (ord.collections.length > 0) {
          rows.push(...ord.collections);
        } else if (ord.collectionStatus === 'Ready for collection') {
          rows.push({
            id: `COL-${ord.reference.replace(/^ORD-/, '')}`,
            orderId: ord.id,
            orderReference: ord.reference,
            item: `${ord.productName} (${ord.itemCount} ${ord.itemCount === 1 ? 'unit' : 'units'})`,
            status: 'Ready for collection',
            location: 'Community 25 Warehouse, Tema',
            date: 'Available Mon–Sat, 9am–6pm',
          });
        }
      }
      setCollections(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load collection records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  return (
    <main className="acct-shell">
      <Link href="/account" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to account</span>
      </Link>

      <div className="acct-head">
        <div>
          <div className="eyebrow">My AmericanHomes</div>
          <h1 className="acct-title">Collections</h1>
        </div>
        <Link href="/policies/collection" className="button" style={{ background: '#fff' }}>
          Collection guide
        </Link>
      </div>

      <section className="acct-panel" style={{ padding: '8px 24px' }}>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadCollections} />
        ) : collections.length === 0 ? (
          <EmptyState
            title="No collections yet"
            description="Items ready for pickup or already collected from our Tema warehouse will appear here."
            action={
              <Link href="/shop" className="button primary">
                Browse products
              </Link>
            }
          />
        ) : (
          collections.map((col, idx) => (
            <div
              key={`${col.id}-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                padding: '20px 0',
                borderTop: idx === 0 ? 0 : '0.8px solid var(--line)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <span className="acct-circle-icon">
                  <Warehouse size={16} />
                </span>
                <div>
                  <span className="acct-order-ref">
                    {col.id} · Order {col.orderReference}
                  </span>
                  <strong style={{ display: 'block', fontSize: 15, marginTop: 4, color: 'var(--ink)' }}>
                    {col.item}
                  </strong>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {col.location} · {col.date}
                  </span>
                </div>
              </div>
              <span className={`acct-pill ${col.status === 'Ready for collection' ? 'blue' : 'gray'}`}>
                ● {col.status}
              </span>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
