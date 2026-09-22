import type { ReactNode } from 'react';

import { Card } from '@/components/ui/Card';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  eyebrow?: string;
  testId?: string;
}

/**
 * Groups related Perfil settings in a titled card section.
 * @param props Section title, optional eyebrow, content, and optional test id.
 * @returns Accessible section card for settings content.
 * @example <SettingsSection title="Cuenta" eyebrow="SEGURIDAD">...</SettingsSection>
 */
export function SettingsSection({ title, children, eyebrow, testId }: SettingsSectionProps) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <div className="flex items-end justify-between gap-3 px-1">
        <h2 className="font-serif text-xl font-semibold tracking-[-0.03em] text-ink">{title}</h2>
        {eyebrow ? (
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {eyebrow}
          </p>
        ) : null}
      </div>
      <Card className="divide-y divide-line overflow-hidden p-0">{children}</Card>
    </section>
  );
}
