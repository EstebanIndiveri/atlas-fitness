import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { DailyCheckInResponse } from '@/lib/api/checkin';

import * as insightCards from './ProgressInsightCards';
import { WellbeingCard } from './ProgressInsightCards';

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
  it('does not export the retired mixed-mode strength chart card', () => {
    const cards = insightCards as unknown as Record<string, unknown>;
    expect(cards.StrengthEvolutionCard).toBeUndefined();
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

  it('states the wellbeing window so the card cannot be read as period-aggregated', () => {
    const { unmount } = render(<WellbeingCard checkin={checkin} loading={false} error={null} />);

    expect(screen.getByText('Refleja solo tu check-in de hoy. No se acumula con el período elegido.')).toBeTruthy();

    unmount();
    render(<WellbeingCard checkin={null} loading={false} error={null} />);

    expect(screen.getByText('Refleja solo tu check-in de hoy. No se acumula con el período elegido.')).toBeTruthy();
  });
});
