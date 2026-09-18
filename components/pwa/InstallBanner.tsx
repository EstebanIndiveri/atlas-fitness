'use client';

import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { PWA_COPY } from '@/lib/pwa/copy';

export function InstallBanner() {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();

  if (!canInstall) {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-lg border border-warning bg-warning-muted p-4"
      data-testid="pwa-install-banner"
      role="region"
      aria-label={PWA_COPY.installTitle}
    >
      <h2 className="text-sm font-semibold text-ink">{PWA_COPY.installTitle}</h2>
      <p className="mt-1 text-sm text-ink">{PWA_COPY.installBody}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="warning"
          onClick={() => void promptInstall()}
          data-testid="pwa-install-cta"
        >
          {PWA_COPY.installCta}
        </Button>
        <Button type="button" variant="secondary" onClick={dismiss}>
          {PWA_COPY.installDismiss}
        </Button>
      </div>
    </div>
  );
}
