import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { HabitCtas } from './HabitCtas';
import { SESSION_COPY } from '@/lib/copy/session';
import { UI_COPY } from '@/lib/copy/ui';
import type { Workout } from '@/lib/db/schema';

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 7,
    userId: 1,
    startedAt: new Date('2026-09-18T12:00:00.000-03:00'),
    endedAt: null,
    note: null,
    mood: null,
    deletedAt: null,
    routineId: null,
    queueJson: null,
    ...overrides,
  };
}

describe('HabitCtas', () => {
  it('shows start and guided CTAs when idle', () => {
    render(<HabitCtas activeWorkout={null} onStartWorkout={jest.fn()} />);
    expect(screen.getByTestId('new-workout-button').textContent).toBe(UI_COPY.startWorkout);
    expect(screen.getByTestId('guided-session-cta').textContent).toBe(SESSION_COPY.guidedCta);
  });

  it('points continue to the guided session when the active workout is a routine', () => {
    render(<HabitCtas activeWorkout={workout({ routineId: 3 })} />);
    const cta = screen.getByTestId('continue-workout-cta');
    expect(cta.getAttribute('href')).toBe('/dashboard/session/7');
    expect(cta.textContent).toBe(SESSION_COPY.continueGuided);
  });
});
