/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CoachAdaptationResult } from '@/types/coach';
import type { CoachRecommendationDto } from '@/lib/services/coach-recommendation';

declare const jest: typeof import('@jest/globals').jest;

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

jest.mock('@/lib/api/coach-recommendations', () => {
  class MockCoachRecommendationsClientError extends Error {
    kind: 'unauthorized' | 'validation' | 'not_found' | 'conflict' | 'generic';
    status: number;
    api: { code: string; message: string } | null;

    constructor(
      kind: 'unauthorized' | 'validation' | 'not_found' | 'conflict' | 'generic',
      message: string,
      status: number,
      api: { code: string; message: string } | null = null,
    ) {
      super(message);
      this.name = 'CoachRecommendationsClientError';
      this.kind = kind;
      this.status = status;
      this.api = api;
    }
  }

  return {
    __esModule: true,
    CoachRecommendationsClientError: MockCoachRecommendationsClientError,
    recordCoachRecommendation: jest.fn(),
    decideCoachRecommendation: jest.fn(),
  };
});

import { CoachPreviewClientError, previewCoachAdaptation } from '@/lib/api/coach-preview';
import {
  CoachRecommendationsClientError,
  decideCoachRecommendation,
  recordCoachRecommendation,
} from '@/lib/api/coach-recommendations';
import { CoachAtlasCard } from './CoachAtlasCard';

const previewMock = jest.mocked(previewCoachAdaptation);
const recordMock = jest.mocked(recordCoachRecommendation);
const decideMock = jest.mocked(decideCoachRecommendation);

const result: CoachAdaptationResult = {
  original: { exerciseCount: 5, setCount: 16, estMinutes: 55 },
  adapted: { exerciseCount: 4, setCount: 11, estMinutes: 32 },
  exerciseDeltas: [
    { exerciseId: 1, name: 'Press banca', action: 'reduced', fromSets: 4, toSets: 3 },
  ],
  reason: 'Bajamos volumen porque registraste energía baja.',
  source: 'deterministic',
};

function recommendation(decision: CoachRecommendationDto['decision'] = 'pending'): CoachRecommendationDto {
  return {
    id: 101,
    userId: 7,
    workoutId: 88,
    dailyCheckInId: null,
    contextSnapshot: null,
    source: 'deterministic',
    result,
    decision,
    decidedAt: decision === 'pending' ? null : '2026-09-20T21:03:00.000Z',
    createdAt: '2026-09-20T21:00:00.000Z',
    updatedAt: '2026-09-20T21:03:00.000Z',
  };
}

describe('CoachAtlasCard', () => {
  beforeEach(() => {
    previewMock.mockReset();
    recordMock.mockReset();
    decideMock.mockReset();
  });

  it('renders the Figma heading, honest provenance copy, three preset chips and free-text input row', () => {
    render(<CoachAtlasCard routineId={42} />);

    expect(screen.getByRole('heading', { name: '◎ Coach Atlas' })).toBeTruthy();
    expect(screen.getByText('Basado en datos biométricos')).toBeTruthy();
    expect(screen.getByText('Ajustes rápidos para tu sesión:')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Estoy cansado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sin poleas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quiero algo más liviano' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Preguntarle algo a Atlas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar pregunta a Atlas' })).toBeTruthy();
  });

  it('disables adaptation controls without a workout routine and never calls preview', () => {
    render(<CoachAtlasCard routineId={null} />);

    expect(screen.getByText('Necesitás un entrenamiento de hoy para adaptar.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tengo 30 min' }));
    expect(previewMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Preguntarle algo a Atlas' }).hasAttribute('disabled')).toBe(true);
  });

  it('calls the preview client with routineId and the selected preset free text', async () => {
    previewMock.mockResolvedValue(result);
    render(<CoachAtlasCard routineId={42} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tengo 30 min' }));

    await waitFor(() => {
      expect(previewMock).toHaveBeenCalledWith({ routineId: 42, freeText: 'Tengo 30 minutos' });
    });
  });

  it('renders successful original-vs-adapted numbers and calls onResult', async () => {
    previewMock.mockResolvedValue(result);
    const onResult = jest.fn();
    render(<CoachAtlasCard routineId={42} onResult={onResult} />);

    fireEvent.click(screen.getByRole('button', { name: 'Estoy cansado' }));

    expect(await screen.findByText('Original')).toBeTruthy();
    expect(screen.getByText('5 ejercicios · 16 series · 55 min')).toBeTruthy();
    expect(screen.getByText('Adaptado')).toBeTruthy();
    expect(screen.getByText('4 ejercicios · 11 series · 32 min')).toBeTruthy();
    expect(screen.getByText('Bajamos volumen porque registraste energía baja.')).toBeTruthy();
    expect(screen.getByText('Sugerencia de Atlas')).toBeTruthy();
    expect(onResult).toHaveBeenCalledWith(result);
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
    render(<CoachAtlasCard routineId={42} />);

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
    render(<CoachAtlasCard routineId={42} />);

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
    render(<CoachAtlasCard routineId={42} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sin poleas' }));

    expect(screen.getByRole('button', { name: 'Adaptando Sin poleas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Estoy cansado' }).hasAttribute('disabled')).toBe(true);

    resolvePreview(result);
    await screen.findByText('Sugerencia de Atlas');
  });

  it('hides recommendation decision buttons when no workoutId is provided', async () => {
    previewMock.mockResolvedValue(result);
    render(<CoachAtlasCard routineId={42} />);

    fireEvent.click(screen.getByRole('button', { name: 'Estoy cansado' }));

    expect(await screen.findByText('Sugerencia de Atlas')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aplicar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull();
  });

  it('records then accepts a shown preview when Aplicar is clicked', async () => {
    previewMock.mockResolvedValue(result);
    recordMock.mockResolvedValue(recommendation());
    decideMock.mockResolvedValue(recommendation('accepted'));
    render(<CoachAtlasCard routineId={42} workoutId={88} />);

    fireEvent.click(screen.getByRole('button', { name: 'Estoy cansado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar' }));

    await waitFor(() => {
      expect(recordMock).toHaveBeenCalledWith({
        workoutId: 88,
        source: 'deterministic',
        result,
      });
    });
    expect(decideMock).toHaveBeenCalledWith({ id: 101, decision: 'accepted' });
    expect(await screen.findByText('Aplicado')).toBeTruthy();
  });

  it('records then rejects a shown preview when Descartar is clicked', async () => {
    previewMock.mockResolvedValue(result);
    recordMock.mockResolvedValue(recommendation());
    decideMock.mockResolvedValue(recommendation('rejected'));
    render(<CoachAtlasCard routineId={42} workoutId={88} />);

    fireEvent.click(screen.getByRole('button', { name: 'Estoy cansado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }));

    await waitFor(() => {
      expect(decideMock).toHaveBeenCalledWith({ id: 101, decision: 'rejected' });
    });
    expect(await screen.findByText('Descartado')).toBeTruthy();
  });

  it('shows a recommendation persistence error and keeps decision actions available', async () => {
    previewMock.mockResolvedValue(result);
    recordMock.mockRejectedValue(
      new CoachRecommendationsClientError(
        'validation',
        'No se pudo guardar la recomendación.',
        400,
        { code: 'VALIDATION', message: 'No se pudo guardar la recomendación.' },
      ),
    );
    render(<CoachAtlasCard routineId={42} workoutId={88} />);

    fireEvent.click(screen.getByRole('button', { name: 'Estoy cansado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar' }));

    expect(await screen.findByText('No se pudo guardar la recomendación.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeTruthy();
    expect(decideMock).not.toHaveBeenCalled();
  });
});
