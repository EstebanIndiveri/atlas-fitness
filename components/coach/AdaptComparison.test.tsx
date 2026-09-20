/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import type { CoachAdaptationResult } from '@/types/coach';
import { AdaptComparison } from './AdaptComparison';

const result: CoachAdaptationResult = {
  original: { exerciseCount: 5, setCount: 16, estMinutes: 55 },
  adapted: { exerciseCount: 4, setCount: 11, estMinutes: 32 },
  exerciseDeltas: [
    { exerciseId: 1, name: 'Press banca', action: 'reduced', fromSets: 4, toSets: 2 },
    { exerciseId: 2, name: 'Curl bíceps', action: 'removed', fromSets: 3, toSets: 0 },
  ],
  reason: 'Bajamos volumen porque registraste energía baja.',
  source: 'ai',
};

describe('AdaptComparison', () => {
  it('renders honest original/adapted metrics, deltas, reason and no efficiency score', () => {
    render(<AdaptComparison result={result} routineName="Torso fuerte" />);

    expect(screen.getByRole('heading', { name: 'Torso fuerte' })).toBeTruthy();
    expect(screen.getByText('Tu plan original')).toBeTruthy();
    expect(screen.getByText('5 ejercicios')).toBeTruthy();
    expect(screen.getByText('16 series')).toBeTruthy();
    expect(screen.getByText('55 min')).toBeTruthy();
    expect(screen.getByText('Propuesta Atlas')).toBeTruthy();
    expect(screen.getByText('4 ejercicios')).toBeTruthy();
    expect(screen.getByText('11 series')).toBeTruthy();
    expect(screen.getByText('32 min')).toBeTruthy();
    expect(screen.getByText('-23 min')).toBeTruthy();
    expect(screen.getByText('-1 ej')).toBeTruthy();
    expect(screen.getByText('-5 series')).toBeTruthy();
    expect(screen.getByText('Bajamos volumen porque registraste energía baja.')).toBeTruthy();
    expect(screen.getAllByText('Sugerencia de Atlas').length).toBeGreaterThan(0);
    expect(screen.queryByText(/eficiencia/i)).toBeNull();
  });
});
