/** Chromium `beforeinstallprompt` — not in lib.dom yet for all TS targets. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

export interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}
