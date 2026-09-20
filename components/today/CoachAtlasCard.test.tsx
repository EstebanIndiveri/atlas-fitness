/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CoachAdaptationResult } from '@/types/coach';

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

describe('CoachAtlasCard', () => {
  beforeEach(() => {
    previewMock.mockReset();
  });

  it('renders the four preset chips and the free-text input row', () => {
    render(<CoachAtlasCard routineId={42} />);

    expect(screen.getByRole('heading', { name: '✦ Coach Atlas' })).toBeTruthy();
    expect(screen.getByText('¿Cambió algo para hoy?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Estoy cansado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sin máquinas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quiero algo más liviano' })).toBeTruthy();
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

    fireEvent.click(screen.getByRole('button', { name: 'Sin máquinas' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Sin máquinas' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Quiero algo más liviano' }));

    expect(screen.getByRole('button', { name: 'Adaptando Quiero algo más liviano' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Estoy cansado' }).hasAttribute('disabled')).toBe(true);

    resolvePreview(result);
    await screen.findByText('Sugerencia de Atlas');
  });
});
