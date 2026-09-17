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
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="ios-install-hint"
    >
      <h2 className="text-sm font-semibold text-slate-900">{PWA_COPY.iosTitle}</h2>
      <p className="mt-1 text-sm text-slate-700">{PWA_COPY.iosBody}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>{PWA_COPY.iosStepShare}</li>
        <li>{PWA_COPY.iosStepAdd}</li>
        <li>{PWA_COPY.iosStepConfirm}</li>
      </ol>
    </section>
  );
}
