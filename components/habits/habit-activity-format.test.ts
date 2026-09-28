import { describe, expect, it } from '@jest/globals';

import { formatHabitActivityDate, formatHabitActivityWeekday } from '@/components/habits/habit-activity-format';

describe('formatHabitActivityDate', () => {
  it('renders a day-first label for a window bound', () => {
    expect(formatHabitActivityDate('2026-09-21')).toBe('21/09/2026');
  });

  it('pads single-digit days and months', () => {
    expect(formatHabitActivityDate('2026-01-05')).toBe('05/01/2026');
  });

  it('keeps a year boundary on its own day', () => {
    expect(formatHabitActivityDate('2026-12-31')).toBe('31/12/2026');
  });

  it.each(['', 'hoy', '2026-9-21', '21/09/2026', '2026-09-21T00:00:00.000Z'])(
    'returns an empty label for %p rather than inventing a date',
    (input) => {
      expect(formatHabitActivityDate(input)).toBe('');
    },
  );
});

describe('formatHabitActivityWeekday', () => {
  it.each([
    ['2026-09-21', 'L'],
    ['2026-09-22', 'M'],
    ['2026-09-23', 'M'],
    ['2026-09-24', 'J'],
    ['2026-09-25', 'V'],
    ['2026-09-26', 'S'],
    ['2026-09-27', 'D'],
  ])('labels %p with the Monday-first Córdoba weekday %p', (localDate, letter) => {
    expect(formatHabitActivityWeekday(localDate)).toBe(letter);
  });

  it.each(['', 'hoy', '2026-9-21', '2026-09-21T00:00:00.000Z'])(
    'returns an empty label for %p rather than inventing a weekday',
    (input) => {
      expect(formatHabitActivityWeekday(input)).toBe('');
    },
  );
});
