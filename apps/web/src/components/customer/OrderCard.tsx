import type { Order } from '@americanhomes/contracts';
import { Badge } from '@/components/ui/badge';
import { formatGHS } from '@/lib/formatting/currency';

export function OrderCard({ order }: { order: Order }) {
  return (
    <article style={{ border: '1px solid var(--line)', padding: 18, background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{order.reference}</strong>
        <Badge variant="green">{order.status}</Badge>
      </div>
      <div style={{ marginTop: 10, color: 'var(--muted)', fontSize: 13 }}>
        {formatGHS(order.totalCents)}
      </div>
    </article>
  );
}
