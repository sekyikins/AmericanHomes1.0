export function SkeletonBlock({
  height = 16,
  width = '100%',
}: {
  height?: number;
  width?: string | number;
}) {
  return (
    <div
      className="ah-skeleton"
      aria-hidden="true"
      style={{
        height,
        width,
        maxWidth: '100%',
        borderRadius: 0,
      }}
    />
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading records"
      style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '0.8px solid var(--line)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'grid', gap: 6, flex: '1 1 180px', minWidth: 0 }}>
            <SkeletonBlock height={14} width="58%" />
            <SkeletonBlock height={11} width="38%" />
          </div>
          <SkeletonBlock height={22} width={82} />
        </div>
      ))}
    </div>
  );
}

export function PreparationSkeleton() {
  return (
    <div role="status" aria-label="Loading preparation workflow">
      <div className="prep-stepper">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="prep-step">
            <SkeletonBlock height={24} width={24} />
            <SkeletonBlock height={12} width="72%" />
            <SkeletonBlock height={10} width="48%" />
          </div>
        ))}
      </div>
      <div className="prep-grid">
        <section className="ship-card" style={{ display: 'grid', gap: 14 }}>
          <SkeletonBlock height={12} width={70} />
          <SkeletonBlock height={22} width="45%" />
          <SkeletonBlock height={13} width="70%" />
          <div className="req-row-2">
            <SkeletonBlock height={44} />
            <SkeletonBlock height={44} />
          </div>
          <SkeletonBlock height={88} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SkeletonBlock height={40} width={150} />
          </div>
        </section>
        <aside className="ship-card" style={{ display: 'grid', gap: 12 }}>
          <SkeletonBlock height={155} />
          <SkeletonBlock height={16} width="65%" />
          <SkeletonBlock height={12} width="45%" />
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} />
        </aside>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" style={{ display: 'grid', gap: 16 }}>
      <SkeletonBlock height={54} />
      <div className="dash-cards">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dash-card" style={{ display: 'grid', gap: 10 }}>
            <SkeletonBlock height={12} width="55%" />
            <SkeletonBlock height={28} width="45%" />
            <SkeletonBlock height={11} width="70%" />
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="acct-panel" style={{ display: 'grid', gap: 12 }}>
          <SkeletonBlock height={18} width="45%" />
          <SkeletonBlock height={180} />
        </div>
        <div className="acct-panel" style={{ display: 'grid', gap: 12 }}>
          <SkeletonBlock height={18} width="45%" />
          <TableSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading settings" className="settings-grid">
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonBlock key={i} height={116} />
      ))}
    </div>
  );
}

export function FinanceSkeleton() {
  return (
    <div role="status" aria-label="Loading financial report" style={{ display: 'grid', gap: 16 }}>
      <div className="fin-kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} height={106} />
        ))}
      </div>
      <div className="fin-mid-grid">
        <SkeletonBlock height={220} />
        <SkeletonBlock height={220} />
      </div>
      <div className="acct-panel">
        <TableSkeleton rows={4} />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({
  count = 4,
  className = 'home-products',
}: {
  count?: number;
  className?: 'home-products' | 'products';
}) {
  return (
    <div className={className} role="status" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="product" aria-hidden="true">
          <div className="product-media-wrap">
            <SkeletonBlock height={260} />
          </div>
          <div className="product-body" style={{ display: 'grid', gap: 8 }}>
            <SkeletonBlock height={11} width="40%" />
            <SkeletonBlock height={18} width="80%" />
            <SkeletonBlock height={16} width="48%" />
            <SkeletonBlock height={12} width="60%" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="pdp-grid" role="status" aria-label="Loading product details">
      <div className="pdp-gallery">
        <SkeletonBlock height={440} />
        <div className="pdp-thumbs">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} height={74} width={74} />
          ))}
        </div>
      </div>
      <div className="pdp-info" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <SkeletonBlock height={12} width={110} />
        <SkeletonBlock height={34} width="78%" />
        <SkeletonBlock height={24} width={140} />
        <SkeletonBlock height={68} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <SkeletonBlock height={44} width={120} />
          <SkeletonBlock height={44} width={180} />
        </div>
        <div className="pdp-trust-strip">
          <SkeletonBlock height={48} />
          <SkeletonBlock height={48} />
        </div>
      </div>
    </div>
  );
}

export function AccountOverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading account summary">
      <section className="acct-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="acct-stat-card">
            <SkeletonBlock height={34} width={34} />
            <div style={{ display: 'grid', gap: 6, flex: 1 }}>
              <SkeletonBlock height={20} width={32} />
              <SkeletonBlock height={12} width="75%" />
            </div>
          </div>
        ))}
      </section>
      <div className="acct-main-grid">
        <section className="acct-panel" style={{ display: 'grid', gap: 12 }}>
          <SkeletonBlock height={18} width={140} />
          <SkeletonBlock height={12} width="65%" />
          <TableSkeleton rows={2} />
        </section>
        <section className="acct-panel" style={{ display: 'grid', gap: 12 }}>
          <SkeletonBlock height={18} width={120} />
          <SkeletonBlock height={12} width="75%" />
          <SkeletonBlock height={72} />
        </section>
      </div>
    </div>
  );
}
