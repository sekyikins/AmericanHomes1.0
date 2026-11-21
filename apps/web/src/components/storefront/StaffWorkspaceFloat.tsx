'use client';

import { LayoutGrid } from 'lucide-react';
import Link from 'next/link';

export function StaffWorkspaceFloat() {
  return (
    <Link href="/staff" className="staff-float">
      <LayoutGrid size={16} strokeWidth={2} />
      <span>Open staff workspace</span>
    </Link>
  );
}
