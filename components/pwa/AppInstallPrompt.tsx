'use client';

import { useState } from 'react';

import { IosInstallHint } from '@/components/pwa/IosInstallHint';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { PWA_COPY } from '@/lib/pwa/copy';

/**
 * Install card shown on the profile/settings screen. Exposes a single
 * "Instalar" action: when the browser provides a native install prompt it is
 * triggered directly, otherwise the manual "Agregar a Inicio" steps are
 * revealed. The card hides itself once the app already runs standalone.
 *
 * @returns The settings install card, or null when the app is already installed.
 */
export function AppInstallPrompt() {
  const { canInstall, isStandalone, promptInstall } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  if (isStandalone) {
    return null;
  }

  const handleInstall = (): void => {
    if (canInstall) {
      void promptInstall();
      return;
    }
    setShowSteps(true);
  };

  return (
    <section
      aria-label={PWA_COPY.appInstallAriaLabel}
      className="rounded-2xl border border-brand/20 bg-surface p-4 shadow-card"
      data-testid="app-install-prompt"
      role="region"
    >
      <h4 className="text-base font-semibold text-ink">{PWA_COPY.appInstallTitle}</h4>
      <p className="mt-1 text-base text-ink-muted">{PWA_COPY.appInstallBody}</p>
      <Button className="mt-4" onClick={handleInstall} size="lg" type="button">
        {PWA_COPY.installCta}
      </Button>
      {showSteps ? (
        <div className="mt-4">
          <IosInstallHint forceVisible />
        </div>
      ) : null}
    </section>
  );
}
