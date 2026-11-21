import type { Reservation } from '@americanhomes/contracts';
import { Badge } from '@/components/ui/badge';

export function ReservationCard({ reservation }: { reservation: Reservation }) {
  return (
    <article style={{ border: '1px solid var(--line)', padding: 18, background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Reservation {reservation.id}</strong>
        <Badge variant="amber">{reservation.status}</Badge>
      </div>
      <div style={{ marginTop: 10, color: 'var(--muted)', fontSize: 13 }}>
        Qty: {reservation.quantity}
      </div>
    </article>
  );
}
