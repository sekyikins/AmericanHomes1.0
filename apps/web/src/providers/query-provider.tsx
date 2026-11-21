'use client';

import type { ReactNode } from 'react';

// Placeholder provider for TanStack Query / SWR integration.
export function QueryProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
