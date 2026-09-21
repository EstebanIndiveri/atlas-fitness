/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

const mockPromptInstall = jest.fn<() => Promise<void>>();
let mockHookState: { canInstall: boolean; isStandalone: boolean; isIos: boolean };

jest.mock('@/hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({
    canInstall: mockHookState.canInstall,
    isStandalone: mockHookState.isStandalone,
    isIos: mockHookState.isIos,
    showIosHint: mockHookState.isIos && !mockHookState.isStandalone,
    promptInstall: mockPromptInstall,
    dismiss: jest.fn(),
  }),
}));

import { AppInstallPrompt } from './AppInstallPrompt';

beforeEach(() => {
  mockHookState = { canInstall: false, isStandalone: false, isIos: false };
  mockPromptInstall.mockReset();
  mockPromptInstall.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AppInstallPrompt (settings install card)', () => {
  it('renders the card with a single "Instalar" action and no dismiss button', () => {
    render(<AppInstallPrompt />);

    expect(screen.getByTestId('app-install-prompt')).toBeTruthy();
    expect(screen.getByText('Llevá Atlas siempre encima')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('Instalar');
    expect(screen.queryByRole('button', { name: 'Aceptar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ahora no' })).toBeNull();
  });

  it('triggers the native prompt when the browser exposes one', () => {
    mockHookState.canInstall = true;
    render(<AppInstallPrompt />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));

    expect(mockPromptInstall).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ios-install-hint')).toBeNull();
  });

  it('reveals the Agregar a Inicio steps when there is no native prompt', () => {
    mockHookState.isIos = true;
    render(<AppInstallPrompt />);

    expect(screen.queryByTestId('ios-install-hint')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));

    const hint = screen.getByTestId('ios-install-hint');
    expect(hint).toBeTruthy();
    expect(hint.textContent).toContain('Agregar a Inicio');
    expect(mockPromptInstall).not.toHaveBeenCalled();
  });

  it('renders nothing once the app already runs standalone', () => {
    mockHookState.isStandalone = true;
    const { container } = render(<AppInstallPrompt />);

    expect(container.firstChild).toBeNull();
  });
});
