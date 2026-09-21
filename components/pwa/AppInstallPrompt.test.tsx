/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppInstallPrompt } from './AppInstallPrompt';
import type { BeforeInstallPromptEvent } from '@/types/pwa';

class DeferredInstallEvent extends Event implements BeforeInstallPromptEvent {
  readonly platforms = ['web'];
  readonly userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });
  readonly prompt = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
}

function installMatchMedia(standalone: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn((query: string): MediaQueryList => ({
      matches: query === '(display-mode: standalone)' ? standalone : false,
      media: query,
      onchange: null,
      addEventListener: jest.fn<MediaQueryList['addEventListener']>(),
      removeEventListener: jest.fn<MediaQueryList['removeEventListener']>(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(() => true),
    })),
  });
}

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
}

describe('AppInstallPrompt', () => {
  const desktopUserAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
  const iosUserAgent =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const originalUserAgent = window.navigator.userAgent;

  beforeEach(() => {
    window.localStorage.clear();
    installMatchMedia(false);
    setUserAgent(desktopUserAgent);
  });

  afterEach(() => {
    setUserAgent(originalUserAgent);
    jest.restoreAllMocks();
  });

  it('renders a personalized notification and triggers the native install prompt on accept', async () => {
    const installEvent = new DeferredInstallEvent('beforeinstallprompt');
    render(<AppInstallPrompt />);

    act(() => {
      window.dispatchEvent(installEvent);
    });

    await screen.findByRole('region', { name: 'Sugerencia para instalar Atlas' });
    expect(screen.getByRole('region', { name: 'Sugerencia para instalar Atlas' })).toBeTruthy();
    expect(screen.getByText(/llevá Atlas siempre encima/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    await waitFor(() => expect(installEvent.prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('app-install-prompt')).toBeNull());
  });

  it('keeps the card mounted until the user choice resolves, then tears it down', async () => {
    let resolveChoice: (value: { outcome: 'accepted'; platform: string }) => void = () => {};
    const userChoice = new Promise<{ outcome: 'accepted'; platform: string }>((resolve) => {
      resolveChoice = resolve;
    });
    class PendingInstallEvent extends Event implements BeforeInstallPromptEvent {
      readonly platforms = ['web'];
      readonly userChoice = userChoice;
      readonly prompt = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    }
    const installEvent = new PendingInstallEvent('beforeinstallprompt');

    render(<AppInstallPrompt />);
    act(() => {
      window.dispatchEvent(installEvent);
    });
    await screen.findByTestId('app-install-prompt');

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(installEvent.prompt).toHaveBeenCalledTimes(1));

    // prompt() has resolved but userChoice is still pending: the card must remain.
    expect(screen.getByTestId('app-install-prompt')).toBeTruthy();

    await act(async () => {
      resolveChoice({ outcome: 'accepted', platform: 'web' });
      await userChoice;
    });

    await waitFor(() => expect(screen.queryByTestId('app-install-prompt')).toBeNull());
  });

  it('does not leak an unhandled rejection when the native prompt rejects', async () => {
    class RejectingInstallEvent extends Event implements BeforeInstallPromptEvent {
      readonly platforms = ['web'];
      readonly userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });
      readonly prompt = jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new DOMException('Already consumed', 'InvalidStateError'));
    }
    const installEvent = new RejectingInstallEvent('beforeinstallprompt');

    render(<AppInstallPrompt />);
    act(() => {
      window.dispatchEvent(installEvent);
    });
    await screen.findByTestId('app-install-prompt');

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    await waitFor(() => expect(installEvent.prompt).toHaveBeenCalledTimes(1));
    // A rejected prompt must still reset the card instead of leaving it stuck.
    await waitFor(() => expect(screen.queryByTestId('app-install-prompt')).toBeNull());
  });

  it('persists dismissal when the user chooses Ahora no', async () => {
    render(<AppInstallPrompt />);

    act(() => {
      window.dispatchEvent(new DeferredInstallEvent('beforeinstallprompt'));
    });

    await screen.findByRole('region', { name: 'Sugerencia para instalar Atlas' });

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(window.localStorage.getItem('atlas:pwa-install-dismissed')).toBe('true');
    expect(screen.queryByRole('region', { name: 'Sugerencia para instalar Atlas' })).toBeNull();
  });

  it('stays hidden when the app is standalone or otherwise not installable', () => {
    installMatchMedia(true);

    render(<AppInstallPrompt />);

    act(() => {
      window.dispatchEvent(new DeferredInstallEvent('beforeinstallprompt'));
    });

    expect(screen.queryByRole('region', { name: 'Sugerencia para instalar Atlas' })).toBeNull();
  });

  it('stays hidden when the user already dismissed the prompt in this browser', () => {
    window.localStorage.setItem('atlas:pwa-install-dismissed', 'true');

    render(<AppInstallPrompt />);

    act(() => {
      window.dispatchEvent(new DeferredInstallEvent('beforeinstallprompt'));
    });

    expect(screen.queryByRole('region', { name: 'Sugerencia para instalar Atlas' })).toBeNull();
  });

  it('reveals iOS Add to Home Screen steps after accepting on iOS', () => {
    setUserAgent(iosUserAgent);

    render(<AppInstallPrompt />);

    expect(screen.queryByTestId('ios-install-hint')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(screen.getByTestId('ios-install-hint')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Agregar a Inicio' })).toBeTruthy();
  });
});
