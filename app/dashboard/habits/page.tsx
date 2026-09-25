import type { JSX } from 'react';

import { HabitsScreen } from '@/components/habits/HabitsScreen';
import { PageContainer } from '@/components/shell/PageContainer';

/**
 * Dedicated daily habits route (`/dashboard/habits`).
 * @returns The habits screen inside the existing dashboard shell.
 */
export default function HabitsPage(): JSX.Element {
  return (
    <PageContainer className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold text-ink">Hábitos</h1>
        <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
          Tu registro manual de hoy, con los valores que cargaste.
        </p>
      </header>
      <HabitsScreen />
    </PageContainer>
  );
}
