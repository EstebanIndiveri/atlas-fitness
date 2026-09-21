import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { HabitDoneMap } from '@/hooks/useHabits';
import type { DailyCheckInResponse } from '@/lib/api/checkin';

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

describe('ProgressInsightCards', () => {
  it('renders an honest empty state for strength when no PR data source exists', () => {
    render(<StrengthEvolutionCard />);

    expect(screen.getByRole('heading', { name: 'Evolución de fuerza' })).toBeTruthy();
    expect(screen.getByText('Todavía no hay suficientes registros para graficar tu fuerza.')).toBeTruthy();
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
