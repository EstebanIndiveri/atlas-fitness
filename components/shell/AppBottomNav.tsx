'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { cn } from '@/lib/ui/cn';
import { APP_NAV_LINKS, bottomNavTestId, isCurrentPath } from './nav-links';

const TAB_ICON: Record<(typeof APP_NAV_LINKS)[number]['tabId'], string> = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z',
  today: 'M7 3v3 M17 3v3 M4 8h16 M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z M9 13l2 2 4-4',
  session: 'M5 6h14v12H5z M9 3h6v3H9z M8 11h8 M8 15h5',
  history: 'M12 7v5l3 2 M21 12a9 9 0 1 1-2.6-6.3',
  settings:
    'M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5z M19.4 13a7.7 7.7 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3h-6l-.4 2.5a7.6 7.6 0 0 0-1.7 1L6.5 6 4.5 9.5 6.5 11a7.7 7.7 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 1.7 1L9 21h6l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.5z',
};

export function AppBottomNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label={UI_COPY.tabNav}
      data-testid={UI_COPY_TEST_IDS.appBottomNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe md:hidden"
    >
      <ul className="grid grid-cols-5">
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
