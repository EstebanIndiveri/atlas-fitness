/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { UserPreferences, UserPreferencesResponse } from '@/types/user-preferences';
import { useGuidedPlan } from './useGuidedPlan';
import type { ExerciseCatalogItem } from '@/types/exercise';

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function preferencesResponse(
  preferences: UserPreferences,
  hasSavedPreferences = true,
): UserPreferencesResponse {
  return { hasSavedPreferences, preferences };
}

function exercise(): ExerciseCatalogItem {
  return {
    id: 1,
    slug: 'press-banca',
    name: 'Press banca',
    muscleGroup: 'Pecho',
    instructions: 'Empujá.',
    imageUrl: null,
    videoUrl: null,
    isSystem: true,
  };
}

const catalog = [exercise()];
const noSavedPreferences = preferencesResponse(
  { goal: null, pace: null, equipment: null },
  false,
);

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useGuidedPlan preference prefill', () => {
  it.each([
    ['muscle', 'Ganar músculo'],
    ['strength', 'Ganar fuerza'],
    ['fitness', 'Mejorar condición física'],
    ['consistency', 'Crear constancia'],
    ['wellbeing', 'Sentirme mejor en el día a día'],
  ] as const)('maps the saved goal %s to its onboarding title', async (goal, title) => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(preferencesResponse({ goal, pace: null, equipment: null })),
    );
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await waitFor(() => expect(result.current.form.goal).toBe(title));
  });

  it.each([
    ['gym', 'Gimnasio completo'],
    ['dumbbells', 'Mancuernas en casa'],
    ['bodyweight', 'Peso corporal'],
    ['bands', 'Bandas elásticas'],
  ] as const)('maps saved equipment %s to its onboarding title', async (equipment, title) => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(preferencesResponse({ goal: null, pace: null, equipment })),
    );
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await waitFor(() => expect(result.current.form.availableEquipment).toBe(title));
  });

  it.each([
    ['days-2', '2'],
    ['days-3', '3'],
    ['days-4', '4'],
    ['days-5', '5'],
  ] as const)('maps saved pace %s to %s editable days', async (pace, expectedDays) => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(preferencesResponse({ goal: null, pace, equipment: null })),
    );
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await waitFor(() => expect(result.current.form.daysPerWeek).toBe(expectedDays));
    if (pace === 'days-5') {
      act(() => result.current.updateField('daysPerWeek', '6'));
      expect(result.current.form.daysPerWeek).toBe('6');
    }
  });

  it('keeps the existing brief defaults when no preference row is saved', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(jsonResponse(noSavedPreferences));
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await waitFor(() => expect(result.current).toHaveProperty('preferenceStatus', 'ready'));
    expect(result.current.form).toEqual({
      goal: '',
      daysPerWeek: '3',
      experience: 'intermediate',
      availableEquipment: 'gimnasio completo',
      sessionLengthMinutes: '55',
      focusAreas: '',
    });
  });

  it('keeps the current default for each null preference field', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(preferencesResponse({ goal: null, pace: 'days-2', equipment: null })),
    );
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await waitFor(() => expect(result.current.form.daysPerWeek).toBe('2'));
    expect(result.current.form.goal).toBe('');
    expect(result.current.form.availableEquipment).toBe('gimnasio completo');
  });

  it('does not overwrite fields edited while the preferences request is pending', async () => {
    let resolvePreferences: (response: Response) => void = () => undefined;
    const pendingPreferences = new Promise<Response>((resolve) => {
      resolvePreferences = resolve;
    });
    global.fetch = jest.fn<typeof fetch>().mockReturnValue(pendingPreferences);
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    act(() => {
      result.current.updateField('goal', 'mi objetivo');
      result.current.updateField('daysPerWeek', '6');
      result.current.updateField('availableEquipment', 'mi equipo');
    });

    await act(async () => {
      resolvePreferences(jsonResponse(preferencesResponse({
        goal: 'strength',
        pace: 'days-4',
        equipment: 'bands',
      })));
    });

    expect(result.current.form).toMatchObject({
      goal: 'mi objetivo',
      daysPerWeek: '6',
      availableEquipment: 'mi equipo',
    });
  });

  it.each([
    [401, 'UNAUTHORIZED', 'Iniciá sesión para cargar tus preferencias.'],
    [503, 'SERVICE_UNAVAILABLE', 'Preferencias temporalmente no disponibles.'],
  ])('surfaces a %i preference error and can retry successfully', async (status, code, message) => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ code, message }, status))
      .mockResolvedValueOnce(jsonResponse(preferencesResponse({
        goal: 'fitness',
        pace: 'days-2',
        equipment: 'bodyweight',
      })));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await waitFor(() => expect(result.current).toHaveProperty('preferenceError', message));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/profile/preferences');
    expect(fetchMock.mock.calls[0]?.[1]).toBeUndefined();

    await act(async () => {
      if ('retryPreferences' in result.current && typeof result.current.retryPreferences === 'function') {
        result.current.retryPreferences();
      } else {
        throw new Error('Preference retry action is missing.');
      }
    });

    await waitFor(() => expect(result.current).toHaveProperty('preferenceStatus', 'ready'));
    expect(result.current.form).toMatchObject({
      goal: 'Mejorar condición física',
      daysPerWeek: '2',
      availableEquipment: 'Peso corporal',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('only reads preferences on load and does not generate or save a plan', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(jsonResponse(noSavedPreferences));
    global.fetch = fetchMock;

    renderHook(() => useGuidedPlan({ catalog }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/profile/preferences');
    expect(fetchMock.mock.calls[0]?.[1]).toBeUndefined();
    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url).includes('/api/training-plan/') || init?.method === 'PUT' || init?.method === 'POST',
    )).toBe(false);
  });
});
