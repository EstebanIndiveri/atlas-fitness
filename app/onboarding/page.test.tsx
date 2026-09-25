/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

import { ONBOARDING_COPY, ONBOARDING_TEST_IDS } from '@/lib/copy/onboarding';
import { isOnboardingDone, readOnboardingAnswers } from '@/lib/onboarding/state';

const replace = jest.fn();
const originalFetch = globalThis.fetch;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

import OnboardingPage from './page';

const [goalStep, paceStep, equipmentStep] = ONBOARDING_COPY.steps;
type MockFetchResponse = Pick<Response, 'ok' | 'status' | 'json'>;
const fetchMock = jest.fn<
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) =>
    Promise<MockFetchResponse>
>();

function jsonResponse(body: unknown, status = 200): MockFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function selectFirstAndContinue(): void {
  fireEvent.click(screen.getAllByTestId(ONBOARDING_TEST_IDS.option)[0]);
  fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.continue));
}

function reachProposal(): void {
  selectFirstAndContinue();
  selectFirstAndContinue();
  selectFirstAndContinue();
}

function finishWizard(): void {
  reachProposal();
  fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.continue));
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: originalFetch,
      });
    } else {
      Reflect.deleteProperty(globalThis, 'fetch');
    }
  });

  it('does not fetch preferences when the page is rendered', () => {
    render(<OnboardingPage />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('syncs answers after explicit Finish, then routes to Hoy', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hasSavedPreferences: true,
        preferences: {
          goal: goalStep.options[0].id,
          pace: paceStep.options[0].id,
          equipment: equipmentStep.options[0].id,
        },
      }),
    );
    render(<OnboardingPage />);

    finishWizard();

    expect(readOnboardingAnswers()).toEqual({
      goal: goalStep.options[0].id,
      pace: paceStep.options[0].id,
      equipment: equipmentStep.options[0].id,
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/today'));
    expect(isOnboardingDone()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profile/preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          goal: goalStep.options[0].id,
          pace: paceStep.options[0].id,
          equipment: equipmentStep.options[0].id,
        }),
      }),
    );
  });

  it('keeps anonymous onboarding local after the preferences endpoint returns 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'UNAUTHORIZED' }, 401));
    render(<OnboardingPage />);

    finishWizard();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/today'));
    expect(readOnboardingAnswers()).toEqual({
      goal: goalStep.options[0].id,
      pace: paceStep.options[0].id,
      equipment: equipmentStep.options[0].id,
    });
    expect(isOnboardingDone()).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('preserves answers and offers retry when authenticated preference sync fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: 'SERVICE_UNAVAILABLE' }, 503))
      .mockResolvedValueOnce(
        jsonResponse({
          hasSavedPreferences: true,
          preferences: {
            goal: goalStep.options[0].id,
            pace: paceStep.options[0].id,
            equipment: equipmentStep.options[0].id,
          },
        }),
      );
    render(<OnboardingPage />);

    finishWizard();

    const finishAlert = await screen.findByRole('alert');
    expect(finishAlert.textContent).toContain('Tus respuestas siguen guardadas en este dispositivo');
    expect(readOnboardingAnswers()).toEqual({
      goal: goalStep.options[0].id,
      pace: paceStep.options[0].id,
      equipment: equipmentStep.options[0].id,
    });
    expect(isOnboardingDone()).toBe(false);
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /reintentar sincronización/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/today'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('imports legacy answers only after confirmation and only if no server row exists', async () => {
    const legacyAnswers = {
      goal: 'wellbeing',
      pace: 'days-4',
      equipment: 'dumbbells',
    };
    window.localStorage.setItem('atlas:onboarding:answers', JSON.stringify(legacyAnswers));
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          hasSavedPreferences: false,
          preferences: { goal: null, pace: null, equipment: null },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ hasSavedPreferences: true, preferences: legacyAnswers }),
      );
    render(<OnboardingPage />);
    reachProposal();

    fireEvent.click(screen.getByTestId('onboarding-import-legacy'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/respuestas anteriores/i)).toBeTruthy();

    fireEvent.click(screen.getByTestId('onboarding-confirm-legacy-import'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/profile/preferences',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/profile/preferences',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'If-None-Match': '*' }),
        body: JSON.stringify(legacyAnswers),
      }),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('never replaces an existing server row when importing legacy answers', async () => {
    window.localStorage.setItem(
      'atlas:onboarding:answers',
      JSON.stringify({ goal: 'wellbeing', pace: 'days-4', equipment: 'dumbbells' }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hasSavedPreferences: true,
        preferences: { goal: null, pace: null, equipment: null },
      }),
    );
    render(<OnboardingPage />);
    reachProposal();

    fireEvent.click(screen.getByTestId('onboarding-import-legacy'));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('onboarding-confirm-legacy-import'));

    const importStatus = await screen.findByRole('status');
    expect(importStatus.textContent).toContain('Ya hay preferencias guardadas en tu cuenta');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('marks completion and routes to Hoy on skip without saving answers or syncing', () => {
    render(<OnboardingPage />);

    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.skip));

    expect(isOnboardingDone()).toBe(true);
    expect(readOnboardingAnswers()).toBeNull();
    expect(replace).toHaveBeenCalledWith('/dashboard/today');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
