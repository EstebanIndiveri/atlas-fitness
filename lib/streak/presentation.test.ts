import { describe, expect, it } from '@jest/globals';
import { STREAK_COPY } from '@/lib/copy/streak';
import {
  daysLabel,
  streakAriaLabel,
  streakDelightMessage,
  streakTone,
} from './presentation';

describe('daysLabel', () => {
  it('uses singular día only for 1', () => {
    expect(daysLabel(1)).toBe('día');
    expect(daysLabel(0)).toBe('días');
    expect(daysLabel(2)).toBe('días');
  });
});

describe('streakTone', () => {
  it('is zero when there is no current streak', () => {
    expect(streakTone(0, 0)).toBe('zero');
    expect(streakTone(0, 4)).toBe('zero');
  });

  it('is record when current matches the longest streak at 2+ days', () => {
    expect(streakTone(3, 3)).toBe('record');
    expect(streakTone(2, 2)).toBe('record');
  });

  it('is active for a first day or a streak below the record', () => {
    expect(streakTone(1, 1)).toBe('active');
    expect(streakTone(2, 10)).toBe('active');
  });
});

describe('streakDelightMessage', () => {
  it('motivates the zero state and celebrates active/record streaks', () => {
    expect(streakDelightMessage(0, 0)).toBe(STREAK_COPY.zeroBody);
    expect(streakDelightMessage(1, 1)).toBe(STREAK_COPY.firstDay);
    expect(streakDelightMessage(4, 9)).toBe(STREAK_COPY.keepGoing);
    expect(streakDelightMessage(5, 5)).toBe(STREAK_COPY.recordBody);
  });
});

describe('streakAriaLabel', () => {
  it('announces current and longest streak in Spanish', () => {
    expect(streakAriaLabel(1, 4)).toContain('Racha actual: 1 día');
    expect(streakAriaLabel(1, 4)).toContain('Mejor racha: 4 días');
    expect(streakAriaLabel(0, 0)).toContain('Racha de hábito');
  });
});
