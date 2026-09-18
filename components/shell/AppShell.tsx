import type { ReactNode } from 'react';
import { UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { AppHeader } from './AppHeader';
import { SkipLink } from './SkipLink';
import type { AppShellVariant } from './types';

export type { AppShellVariant };

type AppShellProps = {
  variant: AppShellVariant;
  children: ReactNode;
};

export function AppShell({ variant, children }: AppShellProps) {
  return (
    <div data-testid={UI_COPY_TEST_IDS.appShell} className="flex min-h-screen flex-col bg-canvas text-ink">
      <SkipLink />
      <AppHeader variant={variant} />
      <main id="contenido" tabIndex={-1} className="flex-1 bg-canvas outline-none">
        {children}
      </main>
    </div>
  );
}
