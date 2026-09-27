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
  description: 'Sesión de gimnasio de 45 minutos con ejercicios reales del catálogo.',
  reason: 'Atlas eligió sentadilla del catálogo para priorizar fuerza.',
  kind: 'gym',
  restSeconds: 120,
  exercises: [
    {
      exerciseId: 1,
      exerciseName: 'Sentadilla',
      muscleGroup: 'Piernas',
      instructions: 'Bajá controlado y mantené el pecho erguido.',
      imageUrl: 'https://cdn.example/sentadilla.jpg',
      videoUrl: 'https://cdn.example/sentadilla.mp4',
      sortOrder: 0,
      targetSets: 3,
      targetReps: 8,
    },
  ],
};

const replacementCandidates = [
  catalog[0],
  {
    id: 2,
    slug: 'puente-gluteos',
    name: 'Puente de glúteos',
    muscleGroup: 'Glúteos',
    instructions: 'Empujá la cadera hacia arriba y controlá la bajada.',
    imageUrl: null,
    videoUrl: null,
    isSystem: true,
    equipment: ['barra'],
    availableLocations: ['gym'],
  },
];

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
    expect(screen.queryByRole('button', { name: 'Generar propuesta' })).toBeNull();
  });

  it('edits a single-session proposal and persists the edited routine only after explicit confirmation', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalog))
      .mockResolvedValueOnce(jsonResponse(draft))
      .mockResolvedValueOnce(jsonResponse(replacementCandidates))
      .mockResolvedValueOnce(jsonResponse({ id: 22 }));
    global.fetch = fetchMock;
    const { default: CoachRoutinePage } = await import('./page');

    render(<CoachRoutinePage />);
    fireEvent.change(await screen.findByLabelText('Objetivo'), { target: { value: 'ganar fuerza' } });
    fireEvent.change(screen.getByLabelText('Áreas de enfoque (opcional)'), { target: { value: 'Piernas' } });
    fireEvent.change(screen.getByLabelText('Equipamiento disponible (opcional)'), { target: { value: 'barra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar propuesta' }));

    expect(await screen.findByText('Propuesta Atlas')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Coach Atlas · Fuerza' })).toBeTruthy();
    expect(screen.getByText('Por qué')).toBeTruthy();
    expect(screen.getByText('Atlas eligió sentadilla del catálogo para priorizar fuerza.')).toBeTruthy();
    expect(screen.getByText('45 minutos')).toBeTruthy();
    expect(screen.queryByText(/días por semana/i)).toBeNull();
    expect(screen.getByText('Origen: fallback')).toBeTruthy();
    expect(screen.getByText('1 ejercicio')).toBeTruthy();
    expect(screen.getByText('3 series')).toBeTruthy();
    expect(screen.getByText('Sentadilla')).toBeTruthy();
    expect(screen.getByText('Bajá controlado y mantené el pecho erguido.')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Sentadilla' }).getAttribute('src')).toBe(
      'https://cdn.example/sentadilla.jpg',
    );
    expect(screen.getByLabelText('Video de Sentadilla').getAttribute('src')).toBe(
      'https://cdn.example/sentadilla.mp4',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.change(screen.getByLabelText('Series para Sentadilla'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Repeticiones para Sentadilla'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar Sentadilla' }));
    const replacementSelect = await screen.findByLabelText('Reemplazar ejercicio Sentadilla');
    expect(await screen.findByRole('option', { name: 'Puente de glúteos · Glúteos' })).toBeTruthy();
    fireEvent.change(replacementSelect, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reemplazo' }));

    expect(await screen.findByText('Puente de glúteos')).toBeTruthy();
    expect(screen.getByText('Empujá la cadera hacia arriba y controlá la bajada.')).toBeTruthy();
    expect((screen.getByLabelText('Series para Puente de glúteos') as HTMLInputElement).value).toBe('4');
    expect((screen.getByLabelText('Repeticiones para Puente de glúteos') as HTMLInputElement).value).toBe('12');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/routines/coach?mode=candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'ganar fuerza',
        focusAreas: ['Piernas'],
        location: 'gym',
        availableEquipment: ['barra'],
        level: 'intermediate',
        sessionLengthMinutes: 45,
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear esta rutina' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/routines'));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/routines/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'ganar fuerza',
        focusAreas: ['Piernas'],
        location: 'gym',
        availableEquipment: ['barra'],
        level: 'intermediate',
        sessionLengthMinutes: 45,
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Coach Atlas · Fuerza',
        description: 'Sesión de gimnasio de 45 minutos con ejercicios reales del catálogo.',
        kind: 'gym',
        restSeconds: 120,
        exercises: [{ exerciseId: 2, sortOrder: 0, targetSets: 4, targetReps: 12 }],
      }),
    });
  });

  it('removes a proposed exercise locally and prevents creating an empty routine', async () => {
    global.fetch = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalog))
      .mockResolvedValueOnce(jsonResponse(draft));
    const { default: CoachRoutinePage } = await import('./page');

    render(<CoachRoutinePage />);
    fireEvent.change(await screen.findByLabelText('Objetivo'), { target: { value: 'ganar fuerza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar propuesta' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar Sentadilla' }));

    expect(await screen.findByText('La propuesta no tiene ejercicios. Agregá uno compatible para poder crear la rutina.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear esta rutina' }).hasAttribute('disabled')).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).not.toHaveBeenCalledWith('/api/routines', expect.anything());
  });

  it('blocks a proposal whose edited total sets exceed its session duration', async () => {
    const volumeDraft = {
      ...draft,
      exercises: ['Sentadilla', 'Press de banca', 'Remo con mancuerna'].map((exerciseName, sortOrder) => ({
        exerciseId: sortOrder + 1,
        exerciseName,
        muscleGroup: 'Piernas',
        instructions: 'Mantené el control del movimiento.',
        imageUrl: null,
        videoUrl: null,
        sortOrder,
        targetSets: 3,
        targetReps: 8,
      })),
    };
    global.fetch = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalog))
      .mockResolvedValueOnce(jsonResponse(volumeDraft));
    const { default: CoachRoutinePage } = await import('./page');

    render(<CoachRoutinePage />);
    fireEvent.change(await screen.findByLabelText('Objetivo'), { target: { value: 'ganar fuerza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar propuesta' }));

    const createButton = await screen.findByRole('button', { name: 'Crear esta rutina' });
    expect(createButton.hasAttribute('disabled')).toBe(false);
    fireEvent.change(screen.getByLabelText('Series para Sentadilla'), { target: { value: '4' } });

    expect((await screen.findByRole('alert')).textContent).toBe(
      'La propuesta supera el volumen máximo de esta sesión.',
    );
    expect(createButton.hasAttribute('disabled')).toBe(true);
  });
});
