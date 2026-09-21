import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { ProgressSummary } from '@/lib/services/progress-summary';
import type { WeekConsistency } from '@/types/week';

import { AtlasInterpretationCard } from './AtlasInterpretationCard';

const summary: ProgressSummary = {
  period: 'month',
  fromLocalDate: '2026-09-01',
  toLocalDate: '2026-09-30',
  completedSessions: 6,
  totalDurationMinutes: 385,
  sessions: [],
};

const week: WeekConsistency = {
  weekStart: '2026-09-14',
  weekEnd: '2026-09-20',
  activeCount: 4,
  days: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-09-${String(14 + index).padStart(2, '0')}`,
    weekdayIndex: index,
    active: index < 4,
    isToday: index === 6,
    isFuture: false,
  })),
};

describe('AtlasInterpretationCard', () => {
  it('summarizes only real completed sessions, duration and weekly consistency', () => {
    render(<AtlasInterpretationCard summary={summary} week={week} />);

    expect(screen.getByRole('heading', { name: 'Interpretación de Atlas' })).toBeTruthy();
    expect(screen.getByText('Coach Atlas')).toBeTruthy();
    expect(screen.getByText(/registraste 6 sesiones/)).toBeTruthy();
    expect(screen.getByText(/6h 25m/)).toBeTruthy();
    expect(screen.getByText(/4 de 7 días activos/)).toBeTruthy();
  });

  it('uses an honest placeholder when there are no completed sessions', () => {
    render(<AtlasInterpretationCard summary={{ ...summary, completedSessions: 0, totalDurationMinutes: 0 }} week={{ ...week, activeCount: 0 }} />);

    expect(screen.getByText('Todavía no hay suficientes datos reales para interpretar una tendencia. Registrá sesiones o check-ins y Atlas va a leerlos acá.')).toBeTruthy();
  });
});
