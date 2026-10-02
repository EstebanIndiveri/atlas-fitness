'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AtlasIcon } from '@/components/ui/AtlasIcon';
import type { AtlasIconName } from '@/components/ui/atlas-icons';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { cn } from '@/lib/ui/cn';
import { APP_NAV_LINKS, bottomNavTestId, isCurrentPath } from './nav-links';

type TabId = (typeof APP_NAV_LINKS)[number]['tabId'];

/** Explicit tab → governed icon mapping; keeps navigation semantics curated. */
const TAB_ICON_NAME: Record<TabId, AtlasIconName> = {
  today: 'today',
  session: 'session',
  progress: 'progress',
  profile: 'profile',
};

function TabIcon({ tabId }: { tabId: TabId }) {
  return <AtlasIcon name={TAB_ICON_NAME[tabId]} data-testid={`${tabId}-tab-icon`} />;
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
