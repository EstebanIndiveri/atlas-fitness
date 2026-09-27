/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockGetActiveTrainingPlan = jest.fn(async () => null);
const originalFetch = global.fetch;

jest.mock('@/lib/api/training-plan', () => ({
  __esModule: true,
  getActiveTrainingPlan: mockGetActiveTrainingPlan,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const catalog = [
  { id: 1, slug: 'press', name: 'Press banca', muscleGroup: 'Pecho', instructions: 'Empujá.', imageUrl: null, videoUrl: null, isSystem: true },
  { id: 2, slug: 'remo', name: 'Remo', muscleGroup: 'Espalda', instructions: 'Tirá.', imageUrl: null, videoUrl: null, isSystem: true },
  { id: 3, slug: 'sentadilla', name: 'Sentadilla', muscleGroup: 'Piernas', instructions: 'Bajá.', imageUrl: null, videoUrl: null, isSystem: true },
  { id: 4, slug: 'plancha', name: 'Plancha', muscleGroup: 'Core', instructions: 'Sostené.', imageUrl: null, videoUrl: null, isSystem: true },
];

const noSavedPreferences = {
  hasSavedPreferences: false,
  preferences: { goal: null, pace: null, equipment: null },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

afterEach(() => {
  global.fetch = originalFetch;
  mockPush.mockClear();
});

describe('GuidedPlanPage', () => {
  it('loads the catalog and renders the guided brief form', async () => {
    global.fetch = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalog))
      .mockResolvedValueOnce(jsonResponse(noSavedPreferences));
    const { default: GuidedPlanPage } = await import('./page');

    render(<GuidedPlanPage />);

    expect(screen.getByRole('status').textContent).toContain('Cargando ejercicios');
    expect(await screen.findByRole('heading', { name: 'Crear plan con Coach Atlas' })).toBeTruthy();
    expect(screen.getByLabelText('Objetivo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generar plan semanal' })).toBeTruthy();
    expect(screen.getByLabelText('Objetivo').getAttribute('maxLength')).toBe('60');
  });

  it('treats a non-array exercises response as a catalog error', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(jsonResponse({ items: catalog }));
    const { default: GuidedPlanPage } = await import('./page');

    render(<GuidedPlanPage />);

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron cargar ejercicios.');
  });

  it('reviews the proposed days and saves them through one guided-save endpoint', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalog))
      .mockResolvedValueOnce(jsonResponse(noSavedPreferences))
      .mockResolvedValueOnce(jsonResponse({
        source: 'fallback',
        name: 'Coach Atlas · fuerza general',
        goal: 'fuerza general',
        days: [
          {
            dayOfWeek: 1,
            title: 'Día 1',
            focus: 'Empuje',
            exercises: [{ exerciseId: 1, exerciseName: 'Press banca', muscleGroup: 'Pecho', sortOrder: 0, targetSets: 3, targetReps: 8 }],
          },
          {
            dayOfWeek: 3,
            title: 'Día 2',
            focus: 'Tirón',
            exercises: [{ exerciseId: 2, exerciseName: 'Remo', muscleGroup: 'Espalda', sortOrder: 0, targetSets: 3, targetReps: 8 }],
          },
          {
            dayOfWeek: 5,
            title: 'Día 3',
            focus: 'Piernas',
            exercises: [{ exerciseId: 3, exerciseName: 'Sentadilla', muscleGroup: 'Piernas', sortOrder: 0, targetSets: 3, targetReps: 8 }],
          },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({ plan: { id: 77 }, schedule: [] }));
    global.fetch = fetchMock;
    const { default: GuidedPlanPage } = await import('./page');

    render(<GuidedPlanPage />);
    fireEvent.change(await screen.findByLabelText('Objetivo'), { target: { value: 'fuerza general' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar plan semanal' }));

    expect(await screen.findByText('Revisá la semana propuesta')).toBeTruthy();
    expect(screen.getByText('Día 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar plan' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/training-plan/guided', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/routines'))).toBe(false);
  });

  it('shows preference loading and preserves edits made before the GET resolves', async () => {
    const pendingPreferences = deferred<Response>();
    const fetchMock = jest.fn<typeof fetch>().mockImplementation((input) => {
      if (String(input) === '/api/exercises') {
        return Promise.resolve(jsonResponse(catalog));
      }
      return pendingPreferences.promise;
    });
    global.fetch = fetchMock;
    const { default: GuidedPlanPage } = await import('./page');

    render(<GuidedPlanPage />);

    expect(await screen.findByRole('heading', { name: 'Crear plan con Coach Atlas' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Cargando preferencias');
    fireEvent.change(screen.getByLabelText('Objetivo'), { target: { value: 'Mi objetivo' } });

    await act(async () => {
      pendingPreferences.resolve(jsonResponse({
        hasSavedPreferences: true,
        preferences: { goal: 'strength', pace: 'days-5', equipment: 'bands' },
      }));
    });

    await waitFor(() => expect(screen.getByLabelText('Objetivo')).toHaveProperty('value', 'Mi objetivo'));
    expect(screen.getByLabelText('Días por semana')).toHaveProperty('value', '5');
    expect(screen.getByLabelText('Equipo disponible')).toHaveProperty('value', 'Bandas elásticas');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/exercises',
      '/api/profile/preferences',
    ]);
  });

  it('shows a preference GET error and retries without generating or saving', async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalog))
      .mockResolvedValueOnce(jsonResponse({
        code: 'UNAUTHORIZED',
        message: 'Iniciá sesión para cargar tus preferencias.',
      }, 401))
      .mockResolvedValueOnce(jsonResponse({
        hasSavedPreferences: true,
        preferences: { goal: 'fitness', pace: null, equipment: null },
      }));
    global.fetch = fetchMock;
    const { default: GuidedPlanPage } = await import('./page');

    render(<GuidedPlanPage />);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Iniciá sesión para cargar tus preferencias.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar preferencias' }));

    await waitFor(() => expect(screen.getByLabelText('Objetivo')).toHaveProperty('value', 'Mejorar condición física'));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/exercises',
      '/api/profile/preferences',
      '/api/profile/preferences',
    ]);
    expect(fetchMock.mock.calls.slice(1).every(([, init]) => init === undefined)).toBe(true);
  });
});
