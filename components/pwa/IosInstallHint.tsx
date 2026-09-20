'use client';

import { PWA_COPY } from '@/lib/pwa/copy';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

interface IosInstallHintProps {
  /** Settings/Home always render copy so Playwright can assert without an iPhone UA. */
  forceVisible?: boolean;
}

export function IosInstallHint({ forceVisible = false }: IosInstallHintProps) {
  const { showIosHint, isStandalone } = useInstallPrompt();

  if (isStandalone && !forceVisible) {
    return null;
  }
  if (!forceVisible && !showIosHint) {
    return null;
  }

  return (
    <section
      className="rounded-lg border border-line bg-surface p-4 shadow-card"
      data-testid="ios-install-hint"
    >
      <h2 className="text-base font-semibold text-ink">{PWA_COPY.iosTitle}</h2>
      <p className="mt-1 text-base text-ink">{PWA_COPY.iosBody}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-base text-ink-muted">
        <li>{PWA_COPY.iosStepShare}</li>
        <li>{PWA_COPY.iosStepAdd}</li>
        <li>{PWA_COPY.iosStepConfirm}</li>
      </ol>
    </section>
  );
}
