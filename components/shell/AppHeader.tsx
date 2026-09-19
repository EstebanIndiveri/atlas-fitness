import Link from 'next/link';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { AppNav, LogoutButton } from './AppNav';
import type { AppShellVariant } from './types';

type AppHeaderProps = {
  variant: AppShellVariant;
};

export function AppHeader({ variant }: AppHeaderProps) {
  const homeHref = variant === 'app' ? '/dashboard' : '/';

  return (
    <header
      data-testid={UI_COPY_TEST_IDS.appHeader}
      className="sticky top-0 z-40 border-b border-line bg-surface/95 pt-safe"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href={homeHref}
          className="shrink-0 rounded-md font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          aria-label={UI_COPY.brand}
        >
          <span className="sm:hidden">{UI_COPY.brandShort}</span>
          <span className="hidden sm:inline">{UI_COPY.brand}</span>
        </Link>
        <div className="flex min-h-11 items-center justify-end gap-1">
          <AppNav variant={variant} />
          {variant === 'app' ? <LogoutButton /> : null}
        </div>
      </div>
    </header>
  );
}
