/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CoachCheckInContext } from '@/hooks/useCoachAdapt';
import type { CoachAdaptationResult } from '@/types/coach';

declare const jest: typeof import('@jest/globals').jest;

const pushMock = jest.fn<(href: string) => void>();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/lib/api/coach-preview', () => {
  class MockCoachPreviewClientError extends Error {
    kind: 'unauthorized' | 'validation' | 'not_found' | 'generic';
    status: number;
    api: { code: string; message: string } | null;

    constructor(
      kind: 'unauthorized' | 'validation' | 'not_found' | 'generic',
      message: string,
      status: number,
      api: { code: string; message: string } | null = null,
    ) {
      super(message);
      this.name = 'CoachPreviewClientError';
      this.kind = kind;
      this.status = status;
      this.api = api;
    }
  }

  return {
    __esModule: true,
    CoachPreviewClientError: MockCoachPreviewClientError,
    previewCoachAdaptation: jest.fn(),
  };
});

import { CoachPreviewClientError, previewCoachAdaptation } from '@/lib/api/coach-preview';
import { CoachAtlasCard } from './CoachAtlasCard';

const previewMock = jest.mocked(previewCoachAdaptation);

const result: CoachAdaptationResult = {
  original: { exerciseCount: 5, setCount: 16, estMinutes: 55 },
  adapted: { exerciseCount: 4, setCount: 11, estMinutes: 32 },
  exerciseDeltas: [
    { exerciseId: 1, name: 'Press banca', action: 'reduced', fromSets: 4, toSets: 3 },
  ],
  reason: 'Bajamos volumen porque registraste energía baja.',
  source: 'deterministic',
};

type CoachAtlasCardProps = Parameters<typeof CoachAtlasCard>[0];
const READY_CHECK_IN: CoachCheckInContext = { dailyCheckInId: 17, mood: 4, energy: 'high' };

function renderCoachCard(
  props: Pick<CoachAtlasCardProps, 'routineId'> & Partial<CoachAtlasCardProps>,
) {
  return render(
    <CoachAtlasCard
      routineId={props.routineId}
      todayAvailability={props.todayAvailability ?? 'ready'}
      todayError={props.todayError ?? null}
      checkInAvailability={props.checkInAvailability ?? 'ready'}
      checkInError={props.checkInError ?? null}
      checkInContext={props.checkInContext === undefined ? READY_CHECK_IN : props.checkInContext}
      {...(props.onResult ? { onResult: props.onResult } : {})}
    />,
  );
}

describe('CoachAtlasCard', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    previewMock.mockReset();
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders the Figma heading, honest provenance copy, three preset chips and free-text input row', () => {
    renderCoachCard({ routineId: 42 });

    expect(screen.getByRole('heading', { name: '◎ Coach Atlas' })).toBeTruthy();
    expect(screen.queryByText('Basado en datos biométricos')).toBeNull();
    expect(screen.getByText('Ajustes rápidos para tu sesión:')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Estoy cansado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sin poleas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quiero algo más liviano' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Preguntarle algo a Atlas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar pregunta a Atlas' })).toBeTruthy();
  });

  it('disables adaptation controls without a workout routine and never calls preview', () => {
    renderCoachCard({ routineId: null, todayAvailability: 'empty' });

    expect(screen.getByText('Necesitás un entrenamiento de hoy para adaptar.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tengo 30 min' }));
    expect(previewMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Preguntarle algo a Atlas' }).hasAttribute('disabled')).toBe(true);
  });

  it('calls the preview client with routineId and the selected preset free text', async () => {
    previewMock.mockResolvedValue(result);
    renderCoachCard({ routineId: 42 });

    fireEvent.click(screen.getByRole('button', { name: 'Tengo 30 min' }));

    await waitFor(() => {
      expect(previewMock).toHaveBeenCalledWith({
        routineId: 42,
        energy: 'high',
        mood: 4,
        freeText: 'Tengo 30 minutos',
      });
    });
  });

  it('renders successful original-vs-adapted numbers and calls onResult', async () => {
    previewMock.mockResolvedValue(result);
    const onResult = jest.fn();
    renderCoachCard({ routineId: 42, onResult });

    fireEvent.click(screen.getByRole('button', { name: 'Estoy cansado' }));

    expect(await screen.findByText('Original')).toBeTruthy();
    expect(screen.getByText('5 ejercicios · 16 series · 55 min')).toBeTruthy();
    expect(screen.getByText('Adaptado')).toBeTruthy();
    expect(screen.getByText('4 ejercicios · 11 series · 32 min')).toBeTruthy();
    expect(screen.getByText('Bajamos volumen porque registraste energía baja.')).toBeTruthy();
    expect(screen.getByText('Sugerencia de Atlas')).toBeTruthy();
    expect(onResult).toHaveBeenCalledWith(result);
  });

  it('shows Today loading distinctly from an empty workout and disables preview', () => {
    renderCoachCard({ routineId: null, todayAvailability: 'loading' });

    expect(screen.getByText('Cargando el entrenamiento de hoy…')).toBeTruthy();
    expect(screen.queryByText('Necesitás un entrenamiento de hoy para adaptar.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows Today load failures distinctly from an empty workout', () => {
    renderCoachCard({
      routineId: null,
      todayAvailability: 'error',
      todayError: 'No se pudo cargar el plan de hoy.',
    });

    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar el plan de hoy.');
    expect(screen.queryByText('Necesitás un entrenamiento de hoy para adaptar.')).toBeNull();
  });

  it('requires a completed check-in before creating a preview', () => {
    renderCoachCard({
      routineId: 42,
      checkInAvailability: 'missing',
      checkInContext: null,
    });

    expect(screen.getByText('Registrá tu ánimo y energía para preparar una vista previa.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows check-in loading and failure states instead of enabling preview', () => {
    const { unmount } = renderCoachCard({
      routineId: 42,
      checkInAvailability: 'loading',
      checkInContext: null,
    });

    expect(screen.getByText('Cargando tu check-in de hoy…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
    unmount();

    renderCoachCard({
      routineId: 42,
      checkInAvailability: 'error',
      checkInError: 'No se pudo cargar el check-in de hoy.',
      checkInContext: null,
    });

    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar el check-in de hoy.');
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
  });

  it('blocks preview while the persisted check-in is being saved', () => {
    renderCoachCard({
      routineId: 42,
      checkInAvailability: 'saving',
      checkInContext: null,
    });

    expect(screen.getByText('Guardando tu check-in…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
  });

  it('renders validation errors honestly when the server needs a check-in', async () => {
    previewMock.mockRejectedValue(
      new CoachPreviewClientError(
        'validation',
        'Necesitás registrar cómo estás hoy antes de adaptar.',
        400,
        { code: 'VALIDATION', message: 'Necesitás registrar cómo estás hoy antes de adaptar.' },
      ),
    );
    renderCoachCard({ routineId: 42 });

    fireEvent.click(screen.getByRole('button', { name: 'Sin poleas' }));

    expect(
      await screen.findByText('Necesitás registrar cómo estás hoy antes de adaptar.'),
    ).toBeTruthy();
  });

  it('clears a previous successful preview when the next preview fails', async () => {
    previewMock
      .mockResolvedValueOnce(result)
      .mockRejectedValueOnce(
        new CoachPreviewClientError(
          'validation',
          'Necesitás registrar cómo estás hoy antes de adaptar.',
          400,
          { code: 'VALIDATION', message: 'Necesitás registrar cómo estás hoy antes de adaptar.' },
        ),
      );
    renderCoachCard({ routineId: 42 });

    fireEvent.click(screen.getByRole('button', { name: 'Estoy cansado' }));
    expect(await screen.findByText('Sugerencia de Atlas')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sin poleas' }));

    expect(
      await screen.findByText('Necesitás registrar cómo estás hoy antes de adaptar.'),
    ).toBeTruthy();
    expect(screen.queryByText('Sugerencia de Atlas')).toBeNull();
    expect(screen.queryByText('4 ejercicios · 11 series · 32 min')).toBeNull();
  });

  it('shows loading on the tapped chip and disables the other chips while preview is in flight', async () => {
    let resolvePreview: (value: CoachAdaptationResult) => void = () => undefined;
    previewMock.mockImplementation(
      () => new Promise<CoachAdaptationResult>((resolve) => { resolvePreview = resolve; }),
    );
    renderCoachCard({ routineId: 42 });

    fireEvent.click(screen.getByRole('button', { name: 'Sin poleas' }));

    expect(screen.getByRole('button', { name: 'Adaptando Sin poleas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Estoy cansado' }).hasAttribute('disabled')).toBe(true);

    resolvePreview(result);
    await screen.findByText('Sugerencia de Atlas');
  });

  it('keeps a preview unapplied and starts the exact adaptation only after explicit activation', async () => {
    previewMock.mockResolvedValue(result);
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 91 }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    renderCoachCard({ routineId: 42 });

    fireEvent.click(screen.getByRole('button', { name: 'Estoy cansado' }));

    expect(await screen.findByText('Sugerencia de Atlas')).toBeTruthy();
    expect(screen.getByText('Vista previa: tu rutina guardada no cambia hasta iniciar la sesión.')).toBeTruthy();
    expect(screen.queryByText('Aplicado')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aplicar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Empezar entrenamiento adaptado' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routineId: 42,
          adaptation: {
            result,
            freeText: 'Estoy cansado',
            dailyCheckInId: 17,
            checkInContext: { mood: 4, energy: 'high' },
          },
        }),
      });
    });
    expect(pushMock).toHaveBeenCalledWith('/dashboard/session/91');
  });

  it('shows the pending state while the persisted start request is in flight', async () => {
    previewMock.mockResolvedValue(result);
    let resolveStart: (response: Response) => void = () => undefined;
    global.fetch = jest.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => { resolveStart = resolve; }),
    ) as unknown as typeof fetch;
    renderCoachCard({ routineId: 42 });

    fireEvent.click(screen.getByRole('button', { name: 'Tengo 30 min' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar entrenamiento adaptado' }));

    expect(screen.getByRole('button', { name: 'Iniciando entrenamiento…' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Iniciando entrenamiento');
    expect(pushMock).not.toHaveBeenCalled();

    resolveStart({
      ok: true,
      status: 201,
      json: async () => ({ id: 92 }),
    } as Response);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/session/92'));
  });

  it('keeps the preview unapplied and displays a conflict without navigating', async () => {
    previewMock.mockResolvedValue(result);
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ code: 'CONFLICT', message: 'Ya tenés un entrenamiento en curso.' }),
    } as Response) as unknown as typeof fetch;
    renderCoachCard({ routineId: 42 });

    fireEvent.click(screen.getByRole('button', { name: 'Estoy cansado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar entrenamiento adaptado' }));

    expect(await screen.findByText('Ya tenés un entrenamiento en curso.')).toBeTruthy();
    expect(screen.getByText('Sugerencia de Atlas')).toBeTruthy();
    expect(screen.queryByText('Aplicado')).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
