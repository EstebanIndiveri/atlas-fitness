import Link from 'next/link';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { AppNav } from './AppNav';
import type { AppShellVariant } from './types';

type AppHeaderProps = {
  variant: AppShellVariant;
};

export function AppHeader({ variant }: AppHeaderProps) {
  const homeHref = variant === 'app' ? '/dashboard' : '/';

  return (
    <header
      data-testid={UI_COPY_TEST_IDS.appHeader}
      className="sticky top-0 z-40 border-b border-line bg-surface/95"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <Link href={homeHref} className="shrink-0 font-semibold text-ink" aria-label={UI_COPY.brand}>
          <span className="sm:hidden">{UI_COPY.brandShort}</span>
          <span className="hidden sm:inline">{UI_COPY.brand}</span>
        </Link>
        <AppNav variant={variant} />
      </div>
    </header>
  );
}
