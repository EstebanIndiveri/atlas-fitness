'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { cn } from '@/lib/ui/cn';
import { APP_NAV_LINKS, bottomNavTestId, isCurrentPath } from './nav-links';

const TAB_ICON: Record<(typeof APP_NAV_LINKS)[number]['tabId'], string> = {
  today: 'M7 3v3 M17 3v3 M4 8h16 M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z M9 13l2 2 4-4',
  session: 'M6.5 9v6 M17.5 9v6 M4 10.5v3 M20 10.5v3 M6.5 12h11',
  progress: 'M4 19V5 M4 19h16 M8 16v-4 M12 16V8 M16 16v-7',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M5 20a7 7 0 0 1 14 0',
};

export function AppBottomNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label={UI_COPY.tabNav}
      data-testid={UI_COPY_TEST_IDS.appBottomNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe md:hidden"
    >
      <ul className="grid grid-cols-4">
        {APP_NAV_LINKS.map((link) => {
          const current = isCurrentPath(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                data-testid={bottomNavTestId(link.tabId)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 touch-manipulation flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  current ? 'text-brand' : 'text-ink-muted hover:text-ink',
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={TAB_ICON[link.tabId]} />
                </svg>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
