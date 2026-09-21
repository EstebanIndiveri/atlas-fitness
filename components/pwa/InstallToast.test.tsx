/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/hooks/useInstallPrompt', () => ({ useInstallPrompt: jest.fn() }));

import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { InstallToast, INSTALL_TOAST_AUTO_DISMISS_MS } from './InstallToast';

const useInstallPromptMock = jest.mocked(useInstallPrompt);

type InstallPromptState = ReturnType<typeof useInstallPrompt>;

function mockPrompt(overrides: Partial<InstallPromptState> = {}) {
  const promptInstall = jest.fn(() => Promise.resolve());
  const dismiss = jest.fn();
  useInstallPromptMock.mockReturnValue({
    isIos: false,
    isStandalone: false,
    showIosHint: false,
    canInstall: true,
    promptInstall,
    dismiss,
    ...overrides,
  } as InstallPromptState);
  return { promptInstall, dismiss };
}

describe('InstallToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders the floating prompt when the app is installable', () => {
    mockPrompt();
    render(<InstallToast />);
    expect(screen.getByTestId('install-toast')).toBeTruthy();
    expect(screen.getByTestId('install-toast')).toHaveProperty('role', 'status');
  });

  it('renders nothing when already installed (standalone)', () => {
    mockPrompt({ isStandalone: true, canInstall: false });
    render(<InstallToast />);
    expect(screen.queryByTestId('install-toast')).toBeNull();
  });

  it('renders nothing when there is nothing to prompt', () => {
    mockPrompt({ canInstall: false, showIosHint: false });
    render(<InstallToast />);
    expect(screen.queryByTestId('install-toast')).toBeNull();
  });

  it('calls promptInstall when the user accepts', () => {
    const { promptInstall } = mockPrompt();
    render(<InstallToast />);
    fireEvent.click(screen.getByTestId('install-toast-accept'));
    expect(promptInstall).toHaveBeenCalledTimes(1);
  });

  it('persists dismissal and hides when the user closes it', () => {
    const { dismiss } = mockPrompt();
    render(<InstallToast />);
    fireEvent.click(screen.getByTestId('install-toast-close'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('install-toast')).toBeNull();
  });

  it('auto-hides after the timeout without persisting a dismissal', () => {
    const { dismiss } = mockPrompt();
    render(<InstallToast />);
    expect(screen.getByTestId('install-toast')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(INSTALL_TOAST_AUTO_DISMISS_MS);
    });

    expect(screen.queryByTestId('install-toast')).toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
