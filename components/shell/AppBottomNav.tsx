'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { cn } from '@/lib/ui/cn';
import { APP_NAV_LINKS, bottomNavTestId, isCurrentPath } from './nav-links';

type TabId = (typeof APP_NAV_LINKS)[number]['tabId'];

const TAB_ICON_PATHS: Record<TabId, readonly string[]> = {
  today: [
    'M7 3.5v3',
    'M17 3.5v3',
    'M4.75 8.5h14.5',
    'M6 5.5h12a1.75 1.75 0 0 1 1.75 1.75V18A1.75 1.75 0 0 1 18 19.75H6A1.75 1.75 0 0 1 4.25 18V7.25A1.75 1.75 0 0 1 6 5.5z',
    'M8 12.25h3',
    'M8 15.75h6',
  ],
  session: [
    'M7 17 17 7',
    'M12.75 7H17v4.25',
    'M17 17 7 7',
    'M7 7v4.25',
    'M7 7h4.25',
  ],
  progress: [
    'M4.5 19.5V5',
    'M4.5 19.5h15',
    'M8 16v-3.5',
    'M12 16v-7',
    'M16 16v-5',
    'M7.75 10.5 11 8l3 2.5 4.25-5',
  ],
  profile: [
    'M12 12.25a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M5.25 20a6.75 6.75 0 0 1 13.5 0',
  ],
};

function TabIcon({ tabId }: { tabId: TabId }) {
  return (
    <svg
      viewBox="0 0 24 24"
      data-testid={`${tabId}-tab-icon`}
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TAB_ICON_PATHS[tabId].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export function AppBottomNav() {
  const currentPathname = usePathname();
  const pathname =
    currentPathname ?? (typeof window === 'undefined' ? '/' : window.location.pathname);

  return (
    <nav
      aria-label={UI_COPY.tabNav}
      data-testid={UI_COPY_TEST_IDS.appBottomNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-canvas/95 px-safe pb-safe shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4 px-2 pt-1.5">
        {APP_NAV_LINKS.map((link) => {
          const current = isCurrentPath(pathname, link.href);
          return (
            <li key={link.href} className="min-w-0">
              <Link
                href={link.href}
                data-testid={bottomNavTestId(link.tabId)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl px-1 pb-2 pt-3 text-[11px] font-semibold leading-none tracking-[-0.01em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  current
                    ? 'bg-brand-muted/70 text-brand'
                    : 'text-ink-muted hover:bg-surface hover:text-ink',
                )}
              >
                {current ? (
                  <span className="absolute top-1 h-1 w-6 rounded-full bg-brand" aria-hidden="true" />
                ) : null}
                <TabIcon tabId={link.tabId} />
                <span>{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
