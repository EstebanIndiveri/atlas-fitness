'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { UI_COPY } from '@/lib/copy/ui';
import { cn } from '@/lib/ui/cn';
import { APP_NAV_LINKS, PUBLIC_NAV_LINKS, isCurrentPath } from './nav-links';
import type { AppShellVariant } from './types';

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

export function LogoutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => void logout()}>
      {UI_COPY.logout}
    </Button>
  );
}

const NAV_LINK_CLASS =
  'rounded-md px-3 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-sm';

type AppNavProps = {
  variant: AppShellVariant;
};

export function AppNav({ variant }: AppNavProps) {
  const pathname = usePathname() ?? '/';
  const links = variant === 'app' ? APP_NAV_LINKS : PUBLIC_NAV_LINKS;

  return (
    <nav
      aria-label={UI_COPY.primaryNav}
      className={cn(
        'items-center justify-end gap-1',
        variant === 'app' ? 'hidden md:flex' : 'flex flex-wrap',
      )}
    >
      {links.map((link) => {
        const current = isCurrentPath(pathname, link.href);
        const testId = 'headerTestId' in link ? link.headerTestId : undefined;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-testid={testId}
            aria-current={current ? 'page' : undefined}
            className={cn(
              NAV_LINK_CLASS,
              current ? 'bg-brand-muted text-ink' : 'text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
