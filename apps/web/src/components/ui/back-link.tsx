'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type MouseEvent, type ReactNode } from 'react';

const STORAGE_KEY = 'ah_nav_history_stack';
let memoryStack: string[] = [];
let pendingAction: 'pop' | 'replace' | null = null;

function readStack(): string[] {
  if (typeof window === 'undefined') return memoryStack;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryStack = parsed.filter((x): x is string => typeof x === 'string');
      }
    }
  } catch {
    // ignore storage errors
  }
  return memoryStack;
}

function writeStack(next: string[]) {
  memoryStack = next.slice(-40);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStack));
  } catch {
    // ignore storage errors
  }
}

export function NavigationHistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const onPopState = () => {
      const currentPath = window.location.pathname;
      const stack = [...readStack()];
      if (stack.length >= 2 && stack[stack.length - 2] === currentPath) {
        stack.pop();
        writeStack(stack);
      } else if (stack[stack.length - 1] !== currentPath) {
        const lastIdx = stack.lastIndexOf(currentPath);
        if (lastIdx !== -1) {
          writeStack(stack.slice(0, lastIdx + 1));
        } else {
          stack.push(currentPath);
          writeStack(stack);
        }
      }
      pendingAction = 'pop';
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const stack = [...readStack()];

    if (pendingAction === 'pop') {
      pendingAction = null;
      if (stack[stack.length - 1] !== pathname) {
        const lastIdx = stack.lastIndexOf(pathname);
        if (lastIdx !== -1) {
          writeStack(stack.slice(0, lastIdx + 1));
        } else {
          writeStack([...stack, pathname]);
        }
      }
      return;
    }

    if (pendingAction === 'replace') {
      pendingAction = null;
      if (stack.length > 0) {
        stack[stack.length - 1] = pathname;
        // Collapse if replacing created adjacent duplicates (e.g. [A, B] -> [A, A] -> [A])
        if (stack.length >= 2 && stack[stack.length - 1] === stack[stack.length - 2]) {
          stack.pop();
        }
        writeStack(stack);
      } else {
        writeStack([pathname]);
      }
      return;
    }

    if (stack[stack.length - 1] !== pathname) {
      stack.push(pathname);
      writeStack(stack);
    }
  }, [pathname]);

  return null;
}

export function BackLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();

    const targetPath = href.split('?')[0] || '/';
    const stack = [...readStack()];
    const prevPath = stack.length >= 2 ? stack[stack.length - 2] : null;

    if (prevPath === targetPath && typeof window !== 'undefined' && window.history.length > 1) {
      stack.pop();
      writeStack(stack);
      pendingAction = 'pop';
      router.back();
    } else {
      pendingAction = 'replace';
      router.replace(href);
    }
  };

  return (
    <Link href={href} replace className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
