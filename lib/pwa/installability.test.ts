import { describe, expect, it } from '@jest/globals';
import {
  isIosSafariUserAgent,
  isStandaloneDisplay,
  shouldShowInstallBanner,
  shouldShowIosInstallHint,
} from './installability';

describe('isIosSafariUserAgent', () => {
  it('detects iPhone Safari', () => {
    expect(
      isIosSafariUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe(true);
  });

  it('detects iPad Safari', () => {
    expect(
      isIosSafariUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
      )
    ).toBe(true);
  });

  it('rejects desktop Chrome', () => {
    expect(
      isIosSafariUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(false);
  });

  it('rejects Android Chrome', () => {
    expect(
      isIosSafariUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36'
      )
    ).toBe(false);
  });
});

describe('isStandaloneDisplay', () => {
  it('is true when display-mode is standalone', () => {
    expect(isStandaloneDisplay(true, false)).toBe(true);
  });

  it('is true when iOS navigator.standalone is true', () => {
    expect(isStandaloneDisplay(false, true)).toBe(true);
  });

  it('is false in a normal browser tab', () => {
    expect(isStandaloneDisplay(false, false)).toBe(false);
  });
});

describe('shouldShowIosInstallHint', () => {
  const iosUa =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  it('shows on iOS Safari that is not installed', () => {
    expect(
      shouldShowIosInstallHint({
        userAgent: iosUa,
        displayModeStandalone: false,
        navigatorStandalone: false,
      })
    ).toBe(true);
  });

  it('hides when already on the Home Screen', () => {
    expect(
      shouldShowIosInstallHint({
        userAgent: iosUa,
        displayModeStandalone: true,
        navigatorStandalone: true,
      })
    ).toBe(false);
  });

  it('hides on desktop Chrome', () => {
    expect(
      shouldShowIosInstallHint({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        displayModeStandalone: false,
      })
    ).toBe(false);
  });
});

describe('shouldShowInstallBanner', () => {
  it('shows when beforeinstallprompt was captured and the app is not standalone', () => {
    expect(shouldShowInstallBanner({ hasDeferredPrompt: true, isStandalone: false })).toBe(true);
  });

  it('hides without a deferred prompt', () => {
    expect(shouldShowInstallBanner({ hasDeferredPrompt: false, isStandalone: false })).toBe(false);
  });

  it('hides when already installed', () => {
    expect(shouldShowInstallBanner({ hasDeferredPrompt: true, isStandalone: true })).toBe(false);
  });
});
