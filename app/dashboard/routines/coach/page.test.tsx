/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const originalFetch = global.fetch;

jest.mock('next/navigation', () => ({
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

const catalog = [
  { id: 1, slug: 'sentadilla', name: 'Sentadilla', muscleGroup: 'Piernas', instructions: 'Bajá.', imageUrl: null, videoUrl: null, isSystem: true },
];

const draft = {
  source: 'fallback',
  name: 'Coach Atlas · Fuerza',
  description: 'Plan simple para fuerza.',
  kind: 'gym',
  restSeconds: 120,
  exercises: [
    { exerciseId: 1, exerciseName: 'Sentadilla', muscleGroup: 'Piernas', sortOrder: 0, targetSets: 3, targetReps: 8 },
  ],
};

beforeEach(() => {
  mockPush.mockClear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('CoachRoutinePage', () => {
  it('renders the initial catalog loading state', async () => {
    global.fetch = jest.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    const { default: CoachRoutinePage } = await import('./page');

    render(<CoachRoutinePage />);

    expect(screen.getByRole('status').textContent).toContain('Cargando catálogo');
    expect(global.fetch).toHaveBeenCalledWith('/api/exercises');
  });

  it('renders an empty catalog state without generation controls', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
    const { default: CoachRoutinePage } = await import('./page');

    render(<CoachRoutinePage />);

    expect(await screen.findByText('No hay ejercicios disponibles para armar una rutina.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Generar rutina' })).toBeNull();
  });

  it('generates a preview and accepts it using the existing routine create contract', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalog))
      .mockResolvedValueOnce(jsonResponse(draft))
      .mockResolvedValueOnce(jsonResponse({ id: 22 }));
    global.fetch = fetchMock;
    const { default: CoachRoutinePage } = await import('./page');

    render(<CoachRoutinePage />);
    fireEvent.change(await screen.findByLabelText('Objetivo'), { target: { value: 'ganar fuerza' } });
    fireEvent.change(screen.getByLabelText('Días por semana'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar rutina' }));

    expect(await screen.findByRole('heading', { name: 'Coach Atlas · Fuerza' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar y crear rutina' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/routines'));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/routines/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'ganar fuerza',
        daysPerWeek: 3,
        location: 'gym',
        level: 'intermediate',
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Coach Atlas · Fuerza',
        description: 'Plan simple para fuerza.',
        kind: 'gym',
        restSeconds: 120,
        exercises: [{ exerciseId: 1, sortOrder: 0, targetSets: 3, targetReps: 8 }],
      }),
    });
  });
});
