'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { PWA_COPY } from '@/lib/pwa/copy';

import { IosInstallHint } from './IosInstallHint';

/** Milliseconds the floating install toast stays visible before auto-hiding. */
export const INSTALL_TOAST_AUTO_DISMISS_MS = 8000;

/**
 * Floating, auto-dismissing install prompt shown on Hoy.
 * Appears when the app is installable and not already installed; it hides on accept,
 * on explicit close (persisted), or automatically after {@link INSTALL_TOAST_AUTO_DISMISS_MS}.
 * @returns The floating toast, or null when there is nothing to prompt.
 * @example <InstallToast />
 */
export function InstallToast() {
  const { canInstall, showIosHint, isStandalone, isIos, promptInstall, dismiss } =
    useInstallPrompt();
  const [autoHidden, setAutoHidden] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  const shouldShow = !isStandalone && (canInstall || showIosHint) && !autoHidden;

  useEffect(() => {
    if (!shouldShow || showIosSteps) {
      return undefined;
    }
    const timer = window.setTimeout(() => setAutoHidden(true), INSTALL_TOAST_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [shouldShow, showIosSteps]);

  const handleAccept = useCallback((): void => {
    if (isIos) {
      setShowIosSteps(true);
      return;
    }
    void promptInstall();
  }, [isIos, promptInstall]);

  const handleClose = useCallback((): void => {
    dismiss();
    setAutoHidden(true);
  }, [dismiss]);

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      aria-label={PWA_COPY.appInstallAriaLabel}
      className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-2xl border border-brand/20 bg-surface p-4 shadow-card sm:inset-x-auto sm:right-4"
      data-testid="install-toast"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand">{PWA_COPY.appInstallEyebrow}</p>
          <h2 className="mt-1 text-base font-bold text-ink">{PWA_COPY.appInstallTitle}</h2>
        </div>
        <button
          type="button"
          aria-label={PWA_COPY.appInstallDismissAria}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-canvas hover:text-ink"
          data-testid="install-toast-close"
          onClick={handleClose}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{PWA_COPY.appInstallBody}</p>
      <div className="mt-3 flex gap-2">
        <Button
          className="min-h-11 flex-1 text-sm"
          data-testid="install-toast-accept"
          onClick={handleAccept}
          type="button"
        >
          {PWA_COPY.appInstallCta}
        </Button>
      </div>
      {showIosSteps ? (
        <div className="mt-3">
          <IosInstallHint forceVisible />
        </div>
      ) : null}
    </div>
  );
}
