import type { ReactNode } from 'react';
import { CustomerFooter } from '@/components/storefront/CustomerFooter';
import { CustomerHeader } from '@/components/storefront/CustomerHeader';

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CustomerHeader />
      {children}
      <CustomerFooter />
    </>
  );
}
