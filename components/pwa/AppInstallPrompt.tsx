'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { PWA_COPY } from '@/lib/pwa/copy';
import { IosInstallHint } from './IosInstallHint';

export function AppInstallPrompt() {
  const { canInstall, dismiss, isIos, isStandalone, promptInstall, showIosHint } =
    useInstallPrompt();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (isStandalone || (!canInstall && !showIosHint)) {
    return null;
  }

  const onAccept = () => {
    if (isIos) {
      setShowIosSteps(true);
      return;
    }

    void promptInstall();
  };

  return (
    <section
      aria-label={PWA_COPY.appInstallAriaLabel}
      className="mt-4 rounded-2xl border border-brand/20 bg-surface p-4 shadow-card"
      data-testid="app-install-prompt"
      role="region"
    >
      <p className="text-base font-semibold text-brand">{PWA_COPY.appInstallEyebrow}</p>
      <h2 className="mt-1 text-lg font-bold text-ink">{PWA_COPY.appInstallTitle}</h2>
      <p className="mt-2 text-base leading-relaxed text-ink-muted">{PWA_COPY.appInstallBody}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="min-h-11 text-base" onClick={onAccept} type="button">
          {PWA_COPY.appInstallCta}
        </Button>
        <Button className="min-h-11 text-base" onClick={dismiss} type="button" variant="secondary">
          {PWA_COPY.installDismiss}
        </Button>
      </div>
      {showIosSteps ? (
        <div className="mt-4">
          <IosInstallHint forceVisible />
        </div>
      ) : null}
    </section>
  );
}
