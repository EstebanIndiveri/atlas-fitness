import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

let routeParams: { id: string } = { id: '12' };
const mockPush = jest.fn();
const originalFetch = global.fetch;

jest.mock('next/navigation', () => ({
  useParams: () => routeParams,
  useRouter: () => ({ push: mockPush }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  const payload = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => payload,
    json: async () => body,
  } as Response;
}

function routineResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    slug: 'empuje-torso-superior',
    name: 'Empuje y torso superior',
    description: null,
    kind: 'gym',
    restSeconds: 120,
    isSystem: true,
    exercises: [
      {
        id: 101,
        routineId: 12,
        exerciseId: 1,
        sortOrder: 0,
        targetSets: 3,
        targetReps: 8,
        exerciseName: 'Press de banca plano',
        muscleGroup: 'Pectoral medio y deltoides',
        instructions: 'Controlá la bajada y empujá firme.',
        imageUrl: null,
        videoUrl: null,
      },
      {
        id: 102,
        routineId: 12,
        exerciseId: 2,
        sortOrder: 1,
        targetSets: 4,
        targetReps: 12,
        exerciseName: 'Extensiones en polea',
        muscleGroup: 'Tríceps braquial',
        instructions: 'Mantené los codos quietos.',
        imageUrl: null,
        videoUrl: null,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  routeParams = { id: '12' };
  mockPush.mockClear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('RoutineDetailPage', () => {
  it('renders a loading state while the routine detail is being fetched', async () => {
    global.fetch = jest.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    const { default: RoutineDetailPage } = await import('./page');

    render(<RoutineDetailPage />);

    expect(screen.getByRole('status').textContent).toContain('Cargando');
    expect(global.fetch).toHaveBeenCalledWith('/api/routines/12');
  });

  it('renders a not-found empty state for missing routines without exposing internals', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ code: 'NOT_FOUND', message: 'Rutina no encontrada' }, 404),
    );
    const { default: RoutineDetailPage } = await import('./page');

    render(<RoutineDetailPage />);

    expect(await screen.findByText('Rutina no encontrada')).toBeTruthy();
    expect(screen.getByText('No existe o no está disponible para tu cuenta.')).toBeTruthy();
    expect(screen.queryByText(/userId|stack|deletedAt/i)).toBeNull();
  });

  it('renders populated routine metadata and the real exercise sequence only from API data', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(jsonResponse(routineResponse()));
    const { default: RoutineDetailPage } = await import('./page');

    render(<RoutineDetailPage />);

    expect(await screen.findByRole('heading', { name: 'Empuje y torso superior' })).toBeTruthy();
    expect(screen.getByText('Detalle de Rutina')).toBeTruthy();
    expect(screen.getByText('● GIMNASIO')).toBeTruthy();
    expect(screen.getByText('Plantilla')).toBeTruthy();
    expect(screen.getByText('◎ 2 ejercicios · 7 series')).toBeTruthy();
    expect(screen.getByText('⏱ Descanso 2 min')).toBeTruthy();
    expect(screen.getByText('◎ Énfasis muscular: Pectoral medio y deltoides, Tríceps braquial.')).toBeTruthy();
    expect(screen.getByText('Press de banca plano')).toBeTruthy();
    expect(screen.getByText('3 series × 8 reps')).toBeTruthy();
    expect(screen.getAllByText('⏱ 2 min descanso')).toHaveLength(2);
    expect(screen.queryByText(/45 min|Semana|Hipertrofia|Barra/)).toBeNull();
  });



  it('computes exercise and set totals from routine exercises instead of hardcoded Figma metrics', async () => {
    const exercises = [
      { id: 101, routineId: 12, exerciseId: 1, sortOrder: 0, targetSets: 3, targetReps: 8, exerciseName: 'Press de banca plano', muscleGroup: 'Pectoral clavicular', instructions: '', imageUrl: null, videoUrl: null },
      { id: 102, routineId: 12, exerciseId: 2, sortOrder: 1, targetSets: 4, targetReps: 10, exerciseName: 'Press inclinado', muscleGroup: 'Pectoral clavicular', instructions: '', imageUrl: null, videoUrl: null },
      { id: 103, routineId: 12, exerciseId: 3, sortOrder: 2, targetSets: 3, targetReps: 12, exerciseName: 'Vuelos laterales', muscleGroup: 'Deltoides anterior', instructions: '', imageUrl: null, videoUrl: null },
      { id: 104, routineId: 12, exerciseId: 4, sortOrder: 3, targetSets: 3, targetReps: 12, exerciseName: 'Fondos', muscleGroup: 'Tríceps braquial', instructions: '', imageUrl: null, videoUrl: null },
      { id: 105, routineId: 12, exerciseId: 5, sortOrder: 4, targetSets: 3, targetReps: 15, exerciseName: 'Extensión con cuerda', muscleGroup: 'Tríceps braquial', instructions: '', imageUrl: null, videoUrl: null },
    ];
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(jsonResponse(routineResponse({ exercises })));
    const { default: RoutineDetailPage } = await import('./page');

    render(<RoutineDetailPage />);

    expect(await screen.findByText('◎ 5 ejercicios · 16 series')).toBeTruthy();
    expect(screen.getByText('◎ Énfasis muscular: Pectoral clavicular, Deltoides anterior, Tríceps braquial.')).toBeTruthy();
    expect(screen.queryByText('◎ 5 ejercicios · 15 series')).toBeNull();
  });

  it('renders an honest empty state when the routine has no exercises', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(jsonResponse(routineResponse({ exercises: [] })));
    const { default: RoutineDetailPage } = await import('./page');

    render(<RoutineDetailPage />);

    expect(await screen.findByRole('heading', { name: 'Empuje y torso superior' })).toBeTruthy();
    expect(screen.getByText('◎ 0 ejercicios · 0 series')).toBeTruthy();
    expect(screen.getByText('Esta rutina todavía no tiene ejercicios cargados.')).toBeTruthy();
  });

  it('starts a workout for this routine and navigates to the guided session', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(routineResponse()))
      .mockResolvedValueOnce(jsonResponse({ id: 88 }));
    global.fetch = fetchMock;
    const { default: RoutineDetailPage } = await import('./page');

    render(<RoutineDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Iniciar este entrenamiento/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/session/88'));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: 12 }),
    });
  });

  it('resumes the active guided session when starting returns a workout conflict', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(routineResponse()))
      .mockResolvedValueOnce(
        jsonResponse({ code: 'CONFLICT', message: 'Ya tienes un entrenamiento en curso' }, 409),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 77, routineId: 12 }));
    global.fetch = fetchMock;
    const { default: RoutineDetailPage } = await import('./page');

    render(<RoutineDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Iniciar este entrenamiento/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/session/77'));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/workouts/active');
  });

  it('links the secondary edit action and constructor tab to the edit page', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(jsonResponse(routineResponse()));
    const { default: RoutineDetailPage } = await import('./page');

    render(<RoutineDetailPage />);

    expect((await screen.findByRole('link', { name: '⚏ Editar rutina' })).getAttribute('href')).toBe(
      '/dashboard/routines/12/edit',
    );
    expect(screen.getByRole('link', { name: '2. Constructor' }).getAttribute('href')).toBe(
      '/dashboard/routines/12/edit',
    );
    expect(screen.getByRole('button', { name: '✦ 3. Coach Atlas' }).hasAttribute('disabled')).toBe(true);
  });
});
