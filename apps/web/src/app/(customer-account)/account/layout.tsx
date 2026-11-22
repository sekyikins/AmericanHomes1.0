'use client';

import type { ReactNode } from 'react';
import { CustomerFooter } from '@/components/storefront/CustomerFooter';
import { CustomerHeader } from '@/components/storefront/CustomerHeader';
import { LoginCard } from '@/components/storefront/LoginModal';
import { TableSkeleton } from '@/components/ui';
import { useAuth } from '@/store/auth.store';

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  return (
    <>
      <CustomerHeader />
      {loading ? (
        <main className="acct-shell">
          <TableSkeleton rows={5} />
        </main>
      ) : !user || user.role === 'STAFF' ? (
        <main style={{ minHeight: '65vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <LoginCard />
        </main>
      ) : (
        children
      )}
      <CustomerFooter />
    </>
  );
}
