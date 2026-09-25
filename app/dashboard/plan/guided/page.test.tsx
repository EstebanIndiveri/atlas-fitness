/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const originalFetch = global.fetch;

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

afterEach(() => {
  global.fetch = originalFetch;
  mockPush.mockClear();
});

describe('GuidedPlanPage', () => {
  it('loads the catalog and renders the guided brief form', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(jsonResponse(catalog));
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

  it('reviews the proposed days and saves through the existing endpoints', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalog))
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
      .mockResolvedValueOnce(jsonResponse({ id: 10 }))
      .mockResolvedValueOnce(jsonResponse({ id: 20 }))
      .mockResolvedValueOnce(jsonResponse({ id: 30 }))
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
    expect(fetchMock).toHaveBeenLastCalledWith('/api/training-plan', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
  });
});
