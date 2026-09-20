/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useInstallPrompt } from './useInstallPrompt';
import type { BeforeInstallPromptEvent } from '@/types/pwa';

class DeferredInstallEvent extends Event implements BeforeInstallPromptEvent {
  readonly platforms = ['web'];
  readonly userChoice = Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' });
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

function InstallPromptHarness() {
  const { canInstall, dismiss } = useInstallPrompt();
  return (
    <div>
      <p data-testid="can-install">{canInstall ? 'visible' : 'hidden'}</p>
      <button type="button" onClick={dismiss}>Ahora no</button>
    </div>
  );
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    installMatchMedia(false);
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists dismissal after the user hides the install prompt', async () => {
    render(<InstallPromptHarness />);

    act(() => {
      window.dispatchEvent(new DeferredInstallEvent('beforeinstallprompt'));
    });

    await waitFor(() => expect(screen.getByTestId('can-install').textContent).toBe('visible'));

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(screen.getByTestId('can-install').textContent).toBe('hidden');
    expect(window.localStorage.getItem('atlas:pwa-install-dismissed')).toBe('true');
  });

  it('hides immediately when dismissal was persisted before mount', async () => {
    window.localStorage.setItem('atlas:pwa-install-dismissed', 'true');

    render(<InstallPromptHarness />);

    act(() => {
      window.dispatchEvent(new DeferredInstallEvent('beforeinstallprompt'));
    });

    await waitFor(() => expect(screen.getByTestId('can-install').textContent).toBe('hidden'));
  });

  it('removes its window listeners on unmount to avoid leaks', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(<InstallPromptHarness />);
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });

  it('continues without crashing when localStorage throws', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode read blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private mode write blocked');
    });

    render(<InstallPromptHarness />);

    act(() => {
      window.dispatchEvent(new DeferredInstallEvent('beforeinstallprompt'));
    });

    await waitFor(() => expect(screen.getByTestId('can-install').textContent).toBe('visible'));

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(screen.getByTestId('can-install').textContent).toBe('hidden');
  });
});
