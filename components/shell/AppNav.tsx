'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { UI_COPY } from '@/lib/copy/ui';
import { cn } from '@/lib/ui/cn';
import type { AppShellVariant } from './types';

const PUBLIC_LINKS = [
  { href: '/login', label: UI_COPY.navLogin },
  { href: '/register', label: UI_COPY.navRegister },
] as const;

const APP_LINKS = [
  { href: '/dashboard', label: UI_COPY.navHome },
  { href: '/dashboard/session', label: UI_COPY.navSession, testId: 'session-link' },
  { href: '/dashboard/history', label: UI_COPY.navHistory },
  { href: '/dashboard/settings', label: UI_COPY.navSettings, testId: 'settings-link' },
] as const;

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

type AppNavProps = {
  variant: AppShellVariant;
};

export function AppNav({ variant }: AppNavProps) {
  const pathname = usePathname() ?? '/';
  const links = variant === 'app' ? APP_LINKS : PUBLIC_LINKS;

  return (
    <nav aria-label={UI_COPY.primaryNav} className="flex flex-wrap items-center justify-end gap-1">
      {links.map((link) => {
        const current = isCurrentPath(pathname, link.href);
        const testId = 'testId' in link ? link.testId : undefined;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-testid={testId}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-xs font-medium sm:text-sm',
              current ? 'bg-brand-muted text-ink' : 'text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            {link.label}
          </Link>
        );
      })}
      {variant === 'app' ? (
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          {UI_COPY.logout}
        </Button>
      ) : null}
    </nav>
  );
}
