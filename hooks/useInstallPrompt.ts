'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  isIosSafariUserAgent,
  isStandaloneDisplay,
  shouldShowInstallBanner,
} from '@/lib/pwa/installability';
import { isInstallDismissed, markInstallDismissed } from '@/lib/pwa/install-dismissal';
import type { BeforeInstallPromptEvent, NavigatorStandalone } from '@/types/pwa';

function subscribeStandalone(onStoreChange: () => void): () => void {
  const media = window.matchMedia('(display-mode: standalone)');
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function getStandaloneSnapshot(): boolean {
  const nav = window.navigator as NavigatorStandalone;
  return isStandaloneDisplay(
    window.matchMedia('(display-mode: standalone)').matches,
    Boolean(nav.standalone)
  );
}

function getIosSnapshot(): boolean {
  return isIosSafariUserAgent(window.navigator.userAgent);
}

function subscribeNoop(): () => void {
  return () => undefined;
}

function getClientFalse(): boolean {
  return false;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(isInstallDismissed);

  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getClientFalse
  );
  const isIos = useSyncExternalStore(subscribeNoop, getIosSnapshot, getClientFalse);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // The saved prompt can be stale/already consumed (e.g. InvalidStateError);
      // drop it below so the card resets instead of leaking a rejected promise.
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    markInstallDismissed();
    setDismissed(true);
  }, []);

  return {
    isIos,
    isStandalone,
    showIosHint: !dismissed && isIos && !isStandalone,
    canInstall:
      !dismissed &&
      shouldShowInstallBanner({
        hasDeferredPrompt: deferredPrompt !== null,
        isStandalone,
      }),
    promptInstall,
    dismiss,
  };
}
