import type { ReactNode } from 'react';
import { AppInstallPrompt } from '@/components/pwa/AppInstallPrompt';
import { UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { cn } from '@/lib/ui/cn';
import { AppBottomNav } from './AppBottomNav';
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
    <div
      data-testid={UI_COPY_TEST_IDS.appShell}
      className="flex min-h-dvh min-h-screen flex-col bg-canvas px-safe text-ink"
    >
      <SkipLink />
      <AppHeader variant={variant} />
      <main
        id="contenido"
        tabIndex={-1}
        className={cn('flex-1 bg-canvas outline-none', variant === 'app' && 'pb-app-nav')}
      >
        {variant === 'app' ? (
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <AppInstallPrompt />
          </div>
        ) : null}
        {children}
      </main>
      {variant === 'app' ? <AppBottomNav /> : null}
    </div>
  );
}
