import type { ReactNode } from 'react';

import { Card } from '@/components/ui/Card';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  testId?: string;
}

/**
 * Groups related Perfil settings in a titled card section.
 * @param props Section title, content, and optional test id.
 * @returns Accessible section card for settings content.
 * @example <SettingsSection title="Cuenta">...</SettingsSection>
 */
export function SettingsSection({ title, children, testId }: SettingsSectionProps) {
  return (
    <section data-testid={testId}>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <div className="divide-y divide-line rounded-md border border-line bg-canvas">{children}</div>
      </Card>
    </section>
  );
}
