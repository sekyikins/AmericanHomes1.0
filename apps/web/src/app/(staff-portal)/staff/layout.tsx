import type { ReactNode } from 'react';
import { AdminShell } from '@/components/staff/AdminShell';

export default function StaffPortalLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
