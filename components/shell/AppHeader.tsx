import Link from 'next/link';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { AppNav, LogoutButton } from './AppNav';
import type { AppShellVariant } from './types';

type AppHeaderProps = {
  variant: AppShellVariant;
};

const BELL_ICON =
  'M6 8a6 6 0 0 1 12 0c0 5 1.5 6.5 2 7H4c.5-.5 2-2 2-7z M10.5 20a1.5 1.5 0 0 0 3 0';

export function AppHeader({ variant }: AppHeaderProps) {
  const homeHref = variant === 'app' ? '/dashboard/today' : '/';
  const isApp = variant === 'app';

  return (
    <header
      data-testid={UI_COPY_TEST_IDS.appHeader}
      className="sticky top-0 z-40 border-b border-line bg-surface/95 pt-safe"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href={homeHref}
          className="shrink-0 rounded-md font-serif text-lg font-semibold tracking-[-0.01em] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          aria-label={UI_COPY.brand}
        >
          <span className="sm:hidden">{UI_COPY.brandShort}</span>
          <span className="hidden sm:inline">{UI_COPY.brand}</span>
        </Link>
        <div className="flex min-h-11 items-center justify-end gap-1">
          <AppNav variant={variant} />
          {isApp ? (
            <>
              <button
                type="button"
                disabled
                data-testid={UI_COPY_TEST_IDS.notificationsButton}
                aria-label={UI_COPY.notifications}
                title={UI_COPY.notificationsSoon}
                className="grid size-11 cursor-not-allowed place-items-center rounded-full text-ink-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={BELL_ICON} />
                </svg>
              </button>
              <div className="hidden md:block">
                <LogoutButton />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
