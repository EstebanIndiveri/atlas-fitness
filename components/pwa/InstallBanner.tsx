'use client';

import { PWA_COPY } from '@/lib/pwa/copy';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallBanner() {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();

  if (!canInstall) {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4"
      data-testid="pwa-install-banner"
      role="region"
      aria-label={PWA_COPY.installTitle}
    >
      <h2 className="text-sm font-semibold text-amber-950">{PWA_COPY.installTitle}</h2>
      <p className="mt-1 text-sm text-amber-900">{PWA_COPY.installBody}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          data-testid="pwa-install-cta"
        >
          {PWA_COPY.installCta}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
        >
          {PWA_COPY.installDismiss}
        </button>
      </div>
    </div>
  );
}
