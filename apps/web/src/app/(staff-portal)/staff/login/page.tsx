import { StaffLoginCard } from '@/components/staff/StaffLoginCard';

export default function StaffLoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--canvas)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <StaffLoginCard />
    </main>
  );
}
