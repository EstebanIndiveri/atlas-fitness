import { describe, expect, it } from '@jest/globals';

import { HABIT_KEYS, type HabitKey } from '@/types/habit';
import type {
  ExpectedHabitDay,
  HabitTargetLogEntry,
} from '@/types/habit-adherence';
import type {
  HabitTargetScheduleVersion,
  HabitTargetWeekday,
} from '@/types/habit-target';
import {
  assertValidHabitTargetSchedules,
  computeHabitTargetAdherence,
  resolveExpectedHabitDays,
} from '@/lib/services/habit-target-adherence';

// 2026-09-21 is a Monday and 2026-09-27 a Sunday in Córdoba.
const MONDAY_21 = '2026-09-21';
const TUESDAY_22 = '2026-09-22';
const THURSDAY_24 = '2026-09-24';
const FRIDAY_25 = '2026-09-25';
const SATURDAY_26 = '2026-09-26';
const SUNDAY_27 = '2026-09-27';
const MONDAY_28 = '2026-09-28';

const ALL_WEEKDAYS: HabitTargetWeekday[] = [0, 1, 2, 3, 4, 5, 6];

function schedule(
  habitKey: HabitKey,
  effectiveFrom: string,
  effectiveTo: string | null,
  weekdays: readonly HabitTargetWeekday[],
  version = 1,
): HabitTargetScheduleVersion {
  return { habitKey, effectiveFrom, effectiveTo, version, weekdays };
}

function log(localDate: string, habitKey: string, done = true): HabitTargetLogEntry {
  return { localDate, habitKey, done };
}

function stateOf(
  window: ReturnType<typeof computeHabitTargetAdherence>,
  localDate: string,
  habitKey: HabitKey,
) {
  const day = window.days.find((entry) => entry.localDate === localDate);
  if (day === undefined) {
    throw new Error(`No window day for ${localDate}`);
  }
  return day.habitStates[habitKey];
}

function resolveDates(input: {
  schedules: readonly HabitTargetScheduleVersion[];
  start: string;
  end: string;
}): string[] {
  return resolveExpectedHabitDays(input).map(
    (entry: ExpectedHabitDay) => `${entry.localDate}:${entry.habitKey}:${entry.weekday}`,
  );
}

describe('assertValidHabitTargetSchedules', () => {
  it('accepts a single valid open-ended version', () => {
    expect(() =>
      assertValidHabitTargetSchedules([schedule('hydration', MONDAY_21, null, [1, 3])]),
    ).not.toThrow();
  });

  it('rejects an unknown habit key', () => {
    expect(() =>
      assertValidHabitTargetSchedules([
        schedule('run' as HabitKey, MONDAY_21, null, [1]),
      ]),
    ).toThrow(/habit/i);
  });

  it('rejects an invalid effectiveFrom date', () => {
    expect(() =>
      assertValidHabitTargetSchedules([schedule('walk', '2026-02-31', null, [1])]),
    ).toThrow(/date/i);
  });

  it('rejects an effectiveTo before effectiveFrom', () => {
    expect(() =>
      assertValidHabitTargetSchedules([schedule('walk', '2026-09-15', '2026-09-14', [1])]),
    ).toThrow(/effective/i);
  });

  it('rejects a non-positive version', () => {
    expect(() =>
      assertValidHabitTargetSchedules([schedule('walk', MONDAY_21, null, [1], 0)]),
    ).toThrow(/version/i);
  });

  it('rejects a non-integer version', () => {
    expect(() =>
      assertValidHabitTargetSchedules([schedule('walk', MONDAY_21, null, [1], 1.5)]),
    ).toThrow(/version/i);
  });

  it('rejects an invalid weekday value', () => {
    const invalid = 7 as unknown as HabitTargetWeekday;
    expect(() =>
      assertValidHabitTargetSchedules([schedule('walk', MONDAY_21, null, [invalid])]),
    ).toThrow(/weekday/i);
  });

  it('rejects a negative weekday value', () => {
    const invalid = -1 as unknown as HabitTargetWeekday;
    expect(() =>
      assertValidHabitTargetSchedules([schedule('walk', MONDAY_21, null, [invalid])]),
    ).toThrow(/weekday/i);
  });

  it('rejects a duplicate weekday', () => {
    expect(() =>
      assertValidHabitTargetSchedules([schedule('walk', MONDAY_21, null, [1, 1])]),
    ).toThrow(/duplicate/i);
  });

  it('rejects an empty weekday selection', () => {
    expect(() =>
      assertValidHabitTargetSchedules([schedule('walk', MONDAY_21, null, [])]),
    ).toThrow(/weekday/i);
  });

  it('rejects overlapping versions of the same habit', () => {
    expect(() =>
      assertValidHabitTargetSchedules([
        schedule('walk', '2026-09-01', '2026-09-15', [1]),
        schedule('walk', '2026-09-10', '2026-09-20', [1]),
      ]),
    ).toThrow(/overlap/i);
  });

  it('rejects a second open-ended version for the same habit', () => {
    expect(() =>
      assertValidHabitTargetSchedules([
        schedule('walk', '2026-09-01', null, [1]),
        schedule('walk', '2026-09-20', null, [1]),
      ]),
    ).toThrow(/overlap/i);
  });

  it('accepts adjacent non-overlapping versions', () => {
    expect(() =>
      assertValidHabitTargetSchedules([
        schedule('walk', '2026-09-01', '2026-09-15', [1]),
        schedule('walk', '2026-09-16', '2026-09-30', [1]),
      ]),
    ).not.toThrow();
  });

  it('does not confuse intervals of different habits', () => {
    expect(() =>
      assertValidHabitTargetSchedules([
        schedule('walk', '2026-09-01', '2026-09-15', [1]),
        schedule('mobility', '2026-09-01', '2026-09-15', [1]),
      ]),
    ).not.toThrow();
  });

  it('is order-independent when detecting overlaps', () => {
    expect(() =>
      assertValidHabitTargetSchedules([
        schedule('walk', '2026-09-10', '2026-09-20', [1]),
        schedule('walk', '2026-09-01', '2026-09-15', [1]),
      ]),
    ).toThrow(/overlap/i);
  });
});

describe('resolveExpectedHabitDays', () => {
  it('returns nothing when there are no schedules', () => {
    expect(resolveDates({ schedules: [], start: MONDAY_21, end: SUNDAY_27 })).toEqual([]);
  });

  it('makes effectiveFrom inclusive and excludes the date immediately before it', () => {
    const versions = [schedule('walk', '2026-09-15', null, [2])]; // Tuesday-only

    expect(resolveDates({ schedules: versions, start: '2026-09-15', end: '2026-09-15' })).toEqual([
      '2026-09-15:walk:2',
    ]);
    expect(resolveDates({ schedules: versions, start: '2026-09-14', end: '2026-09-14' })).toEqual([]);
  });

  it('resolves a Sunday-first Sunday as weekday 0', () => {
    const versions = [schedule('sleep', '2026-09-01', null, [0])];

    expect(resolveDates({ schedules: versions, start: SUNDAY_27, end: SUNDAY_27 })).toEqual([
      '2026-09-27:sleep:0',
    ]);
    expect(resolveDates({ schedules: versions, start: SATURDAY_26, end: SATURDAY_26 })).toEqual([]);
  });

  it('resolves a Sunday-first Monday as weekday 1', () => {
    const versions = [schedule('sleep', '2026-09-01', null, [1])];

    expect(resolveDates({ schedules: versions, start: MONDAY_21, end: MONDAY_21 })).toEqual([
      '2026-09-21:sleep:1',
    ]);
    expect(resolveDates({ schedules: versions, start: SUNDAY_27, end: SUNDAY_27 })).toEqual([]);
  });

  it('selects the version effective on each date at a version-change boundary', () => {
    const versions = [
      schedule('walk', '2026-09-01', '2026-09-15', [1], 1), // Mondays
      schedule('walk', '2026-09-16', null, [2], 2), // Tuesdays from here
    ];

    // 2026-09-14 is a Monday covered by v1 → expected.
    expect(resolveDates({ schedules: versions, start: '2026-09-14', end: '2026-09-14' })).toEqual([
      '2026-09-14:walk:1',
    ]);
    // 2026-09-21 is a Monday under v2 (Tuesdays only) → not expected.
    expect(resolveDates({ schedules: versions, start: MONDAY_21, end: MONDAY_21 })).toEqual([]);
    // 2026-09-22 is a Tuesday under v2 → expected.
    expect(resolveDates({ schedules: versions, start: TUESDAY_22, end: TUESDAY_22 })).toEqual([
      '2026-09-22:walk:2',
    ]);
  });

  it('returns nothing inside a gap between two versions', () => {
    const versions = [
      schedule('walk', '2026-09-01', '2026-09-10', ALL_WEEKDAYS, 1),
      schedule('walk', '2026-09-20', null, ALL_WEEKDAYS, 2),
    ];

    expect(resolveDates({ schedules: versions, start: '2026-09-11', end: '2026-09-19' })).toEqual([]);
    expect(resolveDates({ schedules: versions, start: '2026-09-10', end: '2026-09-10' })).toEqual([
      '2026-09-10:walk:4',
    ]);
    expect(resolveDates({ schedules: versions, start: '2026-09-20', end: '2026-09-20' })).toEqual([
      '2026-09-20:walk:0',
    ]);
  });

  it('orders expected habit-days by ascending date then catalog order', () => {
    const versions = [
      schedule('sleep', MONDAY_21, null, [1]),
      schedule('hydration', MONDAY_21, null, [1]),
      schedule('walk', MONDAY_21, null, [1]),
    ];

    expect(resolveDates({ schedules: versions, start: MONDAY_21, end: MONDAY_21 })).toEqual([
      '2026-09-21:hydration:1',
      '2026-09-21:walk:1',
      '2026-09-21:sleep:1',
    ]);
  });

  it('is deterministic regardless of input schedule order', () => {
    const versions = [
      schedule('walk', '2026-09-16', null, [2], 2),
      schedule('walk', '2026-09-01', '2026-09-15', [1], 1),
    ];

    expect(resolveDates({ schedules: versions, start: MONDAY_21, end: TUESDAY_22 })).toEqual([
      '2026-09-22:walk:2',
    ]);
  });

  it('rejects an invalid interval', () => {
    expect(() =>
      resolveExpectedHabitDays({ schedules: [], start: '2026-09-20', end: '2026-09-10' }),
    ).toThrow(/end/i);
  });

  it('rejects an invalid start date', () => {
    expect(() =>
      resolveExpectedHabitDays({ schedules: [], start: '2026-02-31', end: MONDAY_21 }),
    ).toThrow(/date/i);
  });
});

describe('computeHabitTargetAdherence', () => {
  it('reports no schedules honestly without inventing a denominator', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [],
      logs: [],
    });

    expect(window.configurationState).toBe('not_configured');
    expect(window.metricState).toBe('no_expected_days');
    expect(window.expectedHabitDays).toBe(0);
    expect(window.completedExpectedHabitDays).toBe(0);
    expect(window.extraRecordedHabitDays).toBe(0);
    expect(window.adherencePercent).toBeNull();
    expect(Object.keys(window.perHabit)).toEqual([...HABIT_KEYS]);
    for (const habitKey of HABIT_KEYS) {
      expect(window.perHabit[habitKey]).toEqual({
        configurationState: 'not_configured',
        metricState: 'no_expected_days',
        expectedHabitDays: 0,
        completedExpectedHabitDays: 0,
        extraRecordedHabitDays: 0,
        adherencePercent: null,
      });
    }
    expect(window.days.every((day) => day.isFuture === false)).toBe(true);
  });

  it('uses the Monday-first Córdoba week window while matching Sunday-first weekdays', () => {
    const window = computeHabitTargetAdherence({
      period: 'week',
      today: THURSDAY_24,
      schedules: [schedule('walk', MONDAY_21, null, [1, 6])], // Monday and Saturday
      logs: [],
    });

    expect(window.windowStart).toBe(MONDAY_21);
    expect(window.windowEnd).toBe(SUNDAY_27);
    // Only Monday elapsed so far; Saturday is future.
    expect(window.expectedHabitDays).toBe(1);
    expect(window.metricState).toBe('result');
    expect(stateOf(window, MONDAY_21, 'walk')).toBe('expected_unrecorded');
    expect(stateOf(window, SATURDAY_26, 'walk')).toBe('future_expected');
    expect(window.days.find((day) => day.localDate === SATURDAY_26)?.isFuture).toBe(true);
  });

  it('excludes future expected dates from the denominator', () => {
    const window = computeHabitTargetAdherence({
      period: 'week',
      today: THURSDAY_24,
      schedules: [schedule('walk', MONDAY_21, null, [1, 6])],
      logs: [log(MONDAY_21, 'walk', true)],
    });

    expect(window.expectedHabitDays).toBe(1);
    expect(window.completedExpectedHabitDays).toBe(1);
    expect(stateOf(window, SATURDAY_26, 'walk')).toBe('future_expected');
    expect(window.adherencePercent).toBe(100);
  });

  it('classifies expected completed and expected unrecorded days', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [schedule('walk', '2026-09-01', null, [1])], // Mondays: 09-07, 09-14, 09-21, 09-28
      logs: [log(MONDAY_21, 'walk', true)],
    });

    expect(window.expectedHabitDays).toBe(4);
    expect(window.completedExpectedHabitDays).toBe(1);
    expect(stateOf(window, MONDAY_21, 'walk')).toBe('expected_completed');
    expect(stateOf(window, MONDAY_28, 'walk')).toBe('expected_unrecorded');
    expect(window.metricState).toBe('result');
    expect(window.adherencePercent).toBe(25);
  });

  it('classifies extra records without touching the denominator', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [schedule('walk', '2026-09-01', null, [1])],
      logs: [log(TUESDAY_22, 'walk', true)],
    });

    expect(window.expectedHabitDays).toBe(4);
    expect(window.completedExpectedHabitDays).toBe(0);
    expect(window.extraRecordedHabitDays).toBe(1);
    expect(window.perHabit.walk.extraRecordedHabitDays).toBe(1);
    expect(stateOf(window, TUESDAY_22, 'walk')).toBe('extra_recorded');
  });

  it('keeps pre-target completions as extra activity only', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [schedule('walk', '2026-09-15', null, [1])], // Mondays: 09-21, 09-28
      logs: [log('2026-09-14', 'walk', true)],
    });

    expect(window.expectedHabitDays).toBe(2);
    expect(window.completedExpectedHabitDays).toBe(0);
    expect(window.extraRecordedHabitDays).toBe(1);
    expect(stateOf(window, '2026-09-14', 'walk')).toBe('extra_recorded');
  });

  it('marks an unrecorded non-expected elapsed day as not_expected', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [schedule('walk', '2026-09-01', null, [1])],
      logs: [],
    });

    expect(stateOf(window, TUESDAY_22, 'walk')).toBe('not_expected');
  });

  it('reports a real 0/N result instead of hiding zeroes', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [schedule('walk', '2026-09-01', null, [1])],
      logs: [],
    });

    expect(window.expectedHabitDays).toBe(4);
    expect(window.completedExpectedHabitDays).toBe(0);
    expect(window.metricState).toBe('result');
    expect(window.adherencePercent).toBe(0);
    expect(Number.isNaN(window.adherencePercent ?? 0)).toBe(false);
  });

  it('reports a real N/N result', () => {
    const window = computeHabitTargetAdherence({
      period: 'week',
      today: THURSDAY_24,
      schedules: [schedule('walk', MONDAY_21, null, [1, 2, 3])],
      logs: [log(MONDAY_21, 'walk'), log(TUESDAY_22, 'walk'), log('2026-09-23', 'walk')],
    });

    expect(window.expectedHabitDays).toBe(3);
    expect(window.completedExpectedHabitDays).toBe(3);
    expect(window.adherencePercent).toBe(100);
    expect(window.metricState).toBe('result');
  });

  it('rounds the percentage with Math.round', () => {
    const one = computeHabitTargetAdherence({
      period: 'week',
      today: THURSDAY_24,
      schedules: [schedule('walk', MONDAY_21, null, [1, 2, 3])],
      logs: [log(MONDAY_21, 'walk')],
    });
    const two = computeHabitTargetAdherence({
      period: 'week',
      today: THURSDAY_24,
      schedules: [schedule('walk', MONDAY_21, null, [1, 2, 3])],
      logs: [log(MONDAY_21, 'walk'), log(TUESDAY_22, 'walk')],
    });

    expect(one.adherencePercent).toBe(33);
    expect(two.adherencePercent).toBe(67);
  });

  it('treats done:false as no completion', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [schedule('walk', '2026-09-01', null, [1])],
      logs: [log(MONDAY_21, 'walk', false)],
    });

    expect(window.completedExpectedHabitDays).toBe(0);
    expect(window.extraRecordedHabitDays).toBe(0);
    expect(stateOf(window, MONDAY_21, 'walk')).toBe('expected_unrecorded');
  });

  it('ignores a quantitative amount for adherence', () => {
    const withAmount = { localDate: MONDAY_21, habitKey: 'hydration', done: true, amount: 2.5 };
    const withoutAmount = log(MONDAY_21, 'hydration', true);
    const input = {
      period: 'month' as const,
      today: MONDAY_28,
      schedules: [schedule('hydration', '2026-09-01', null, [1])],
    };

    const withAmountWindow = computeHabitTargetAdherence({ ...input, logs: [withAmount] });
    const withoutAmountWindow = computeHabitTargetAdherence({ ...input, logs: [withoutAmount] });

    expect(withAmountWindow.completedExpectedHabitDays).toBe(1);
    expect(withAmountWindow).toMatchObject(withoutAmountWindow);
  });

  it('counts each habit on the same date as a separate habit-day', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [
        schedule('hydration', '2026-09-01', null, [1]),
        schedule('walk', '2026-09-01', null, [1]),
      ],
      logs: [log(MONDAY_21, 'hydration'), log(MONDAY_21, 'walk')],
    });

    // Two habits × four elapsed Mondays (09-07, 09-14, 09-21, 09-28) = 8 habit-days.
    expect(window.expectedHabitDays).toBe(8);
    expect(window.completedExpectedHabitDays).toBe(2);
    expect(window.perHabit.hydration.expectedHabitDays).toBe(4);
    expect(window.perHabit.walk.expectedHabitDays).toBe(4);
  });

  it('reports partial configuration from the fixed catalog', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [
        schedule('hydration', MONDAY_28, null, [1]),
        schedule('walk', MONDAY_28, null, [1]),
      ],
      logs: [],
    });

    expect(window.configurationState).toBe('partially_configured');
    expect(window.perHabit.hydration.configurationState).toBe('configured');
    expect(window.perHabit.walk.configurationState).toBe('configured');
    expect(window.perHabit.mobility.configurationState).toBe('not_configured');
    expect(window.perHabit.sleep.configurationState).toBe('not_configured');
  });

  it('reports full configuration when all four catalog habits are active today', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: HABIT_KEYS.map((habitKey) => schedule(habitKey, MONDAY_28, null, [1])),
      logs: [],
    });

    expect(window.configurationState).toBe('configured');
  });

  it('keeps a configured habit with zero denominator independent from configuration', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [schedule('walk', MONDAY_28, null, [3])], // Wednesday-only, first one is future
      logs: [],
    });

    expect(window.configurationState).toBe('partially_configured');
    expect(window.perHabit.walk.configurationState).toBe('configured');
    expect(window.perHabit.walk.metricState).toBe('no_expected_days');
    expect(window.perHabit.walk.adherencePercent).toBeNull();
    expect(window.metricState).toBe('no_expected_days');
    expect(window.adherencePercent).toBeNull();
  });

  it('keeps an ended schedule as not_configured while preserving its historical result', () => {
    const window = computeHabitTargetAdherence({
      period: 'month',
      today: MONDAY_28,
      schedules: [schedule('walk', '2026-09-01', '2026-09-10', [1])], // Monday 09-07 only
      logs: [log('2026-09-07', 'walk', true)],
    });

    expect(window.configurationState).toBe('not_configured');
    expect(window.perHabit.walk.configurationState).toBe('not_configured');
    expect(window.metricState).toBe('result');
    expect(window.expectedHabitDays).toBe(1);
    expect(window.completedExpectedHabitDays).toBe(1);
    expect(window.adherencePercent).toBe(100);
    expect(stateOf(window, '2026-09-07', 'walk')).toBe('expected_completed');
    expect(stateOf(window, '2026-09-14', 'walk')).toBe('not_expected');
  });

  it('represents all five daily states exactly', () => {
    const window = computeHabitTargetAdherence({
      period: 'week',
      today: THURSDAY_24,
      schedules: [schedule('walk', MONDAY_21, null, [1, 4, 5])], // Monday + Thursday + Friday
      logs: [log(MONDAY_21, 'walk'), log(TUESDAY_22, 'walk')],
    });

    expect(stateOf(window, MONDAY_21, 'walk')).toBe('expected_completed');
    expect(stateOf(window, THURSDAY_24, 'walk')).toBe('expected_unrecorded');
    expect(stateOf(window, TUESDAY_22, 'walk')).toBe('extra_recorded');
    expect(stateOf(window, '2026-09-23', 'walk')).toBe('not_expected');
    expect(stateOf(window, FRIDAY_25, 'walk')).toBe('future_expected');
  });

  it('rejects an invalid today date', () => {
    expect(() =>
      computeHabitTargetAdherence({
        period: 'month',
        today: '2026-02-31',
        schedules: [],
        logs: [],
      }),
    ).toThrow(/date/i);
  });

  it('rejects invalid schedules before computing', () => {
    expect(() =>
      computeHabitTargetAdherence({
        period: 'month',
        today: MONDAY_28,
        schedules: [schedule('walk', MONDAY_28, null, [])],
        logs: [],
      }),
    ).toThrow(/weekday/i);
  });

  it('exposes the window contract and nothing else', () => {
    const window = computeHabitTargetAdherence({
      period: 'week',
      today: THURSDAY_24,
      schedules: [],
      logs: [],
    });

    expect(Object.keys(window).sort()).toEqual([
      'adherencePercent',
      'completedExpectedHabitDays',
      'configurationState',
      'days',
      'expectedHabitDays',
      'extraRecordedHabitDays',
      'metricState',
      'perHabit',
      'period',
      'today',
      'windowEnd',
      'windowStart',
    ]);
  });
});
