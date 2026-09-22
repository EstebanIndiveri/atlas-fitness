import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { HabitDoneMap } from '@/hooks/useHabits';
import type { DailyCheckInResponse } from '@/lib/api/checkin';
import type { StrengthProgressSummary } from '@/lib/services/strength-progress';

import { HabitConsistencyCard, StrengthEvolutionCard, WellbeingCard } from './ProgressInsightCards';

const doneByKey: HabitDoneMap = {
  hydration: true,
  walk: false,
  mobility: true,
  sleep: false,
};

const checkin: DailyCheckInResponse = {
  id: 1,
  userId: 7,
  localDate: '2026-09-20',
  mood: 4,
  energy: 'high',
  note: 'Dormí bien',
  createdAt: '2026-09-20T12:00:00.000Z',
  updatedAt: '2026-09-20T12:00:00.000Z',
};

const strength: StrengthProgressSummary = {
  hasLoggedSets: true,
  latestVolumeKg: '360',
  trendLabel: 'Subiendo',
  points: [
    {
      workoutId: 10,
      startedAt: '2026-09-22T12:00:00.000Z',
      localDate: '2026-09-22',
      totalVolumeKg: '270',
      completedSets: 2,
    },
    {
      workoutId: 11,
      startedAt: '2026-09-24T12:00:00.000Z',
      localDate: '2026-09-24',
      totalVolumeKg: '360',
      completedSets: 2,
    },
  ],
};

describe('ProgressInsightCards', () => {
  it('renders an honest empty state for strength when no completed sets exist', () => {
    render(<StrengthEvolutionCard strength={{ hasLoggedSets: false, latestVolumeKg: null, trendLabel: 'Sin datos de fuerza', points: [] }} />);

    expect(screen.getByRole('heading', { name: 'Evolución de fuerza' })).toBeTruthy();
    expect(screen.getByText('Todavía no hay series completadas para graficar tu fuerza.')).toBeTruthy();
  });

  it('renders a real volume chart from sourced strength progression points', () => {
    render(<StrengthEvolutionCard strength={strength} />);

    expect(screen.getByRole('heading', { name: 'Evolución de fuerza' })).toBeTruthy();
    expect(screen.getByLabelText('Volumen de la última sesión').textContent).toContain('360 kg');
    expect(screen.getByText('Subiendo')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Evolución de volumen por sesión' })).toBeTruthy();
    expect(screen.getByText('Ver ejercicios ▸')).toBeTruthy();
    expect(screen.getByText('Última sesión: 360 kg · 2 series')).toBeTruthy();
  });

  it('labels a single strength session as a starting point instead of hiding it', () => {
    render(<StrengthEvolutionCard strength={{ ...strength, trendLabel: 'Punto de partida', points: [strength.points[0]], latestVolumeKg: '270' }} />);

    expect(screen.getByText('Punto de partida')).toBeTruthy();
    expect(screen.getByTestId('strength-chart-series')).toBeTruthy();
    expect(screen.getByText('Primer punto real: seguí registrando para ver la tendencia.')).toBeTruthy();
  });

  it('summarizes today wellbeing check-in when real data is available', () => {
    render(<WellbeingCard checkin={checkin} loading={false} error={null} />);

    expect(screen.getByRole('heading', { name: 'Bienestar registrado' })).toBeTruthy();
    expect(screen.getByLabelText('Ánimo registrado').textContent).toContain('4/5');
    expect(screen.getByLabelText('Energía registrada').textContent).toContain('Alta');
    expect(screen.getByText('Dormí bien')).toBeTruthy();
  });

  it('uses an empty wellbeing state when no check-in exists', () => {
    render(<WellbeingCard checkin={null} loading={false} error={null} />);

    expect(screen.getByText('Todavía no registraste ánimo o energía hoy.')).toBeTruthy();
  });

  it('does not fabricate habit consistency percentages from today-only habit data', () => {
    render(<HabitConsistencyCard doneByKey={doneByKey} loading={false} error={null} />);

    expect(screen.getByRole('heading', { name: 'Hábitos consistentes' })).toBeTruthy();
    expect(screen.getByText('Todavía no hay historial suficiente para calcular consistencia por hábito.')).toBeTruthy();
    expect(screen.getByText('Hoy registraste 2 de 4 hábitos; eso no se muestra como porcentaje histórico.')).toBeTruthy();
  });
});
