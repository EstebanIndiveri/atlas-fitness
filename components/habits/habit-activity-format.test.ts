import { describe, expect, it } from '@jest/globals';

import { formatHabitActivityDate } from '@/components/habits/habit-activity-format';

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
