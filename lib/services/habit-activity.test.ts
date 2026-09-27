import { beforeEach, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcryptjs';

import { db } from '@/lib/db/client';
import { habitLogs, users } from '@/lib/db/schema';
import { addLocalDateDays, localDateWeekdayIndex } from '@/lib/time/cordoba';
import { getProgressSummary } from '@/lib/services/progress-summary';
import { computeHabitActivity, getHabitActivityForUser } from '@/lib/services/habit-activity';
import { computeWeekConsistency } from '@/lib/services/weekly-consistency';
import { HABIT_KEYS } from '@/types/habit';
import { INSIGHT_MINIMUM_ELAPSED_DAYS, type HabitActivityLogEntry } from '@/types/habit-activity';

// 2026-09-24 is a Thursday in Córdoba, so its Monday-first week runs 2026-09-21..2026-09-27.
const THURSDAY = '2026-09-24';
const THURSDAY_WEEK_START = '2026-09-21';
const THURSDAY_WEEK_END = '2026-09-27';
const THURSDAY_ELAPSED_DAYS = 4;
const SATURDAY = '2026-09-26'; // 6 elapsed days: one short of the insight threshold.
const SUNDAY = '2026-09-27'; // 7 elapsed days: the week is fully elapsed.
const MONDAY = '2026-09-28';
const MONDAY_WEEK_END = '2026-10-04';
const MONDAY_ELAPSED_DAYS = 1;

// Córdoba is UTC-3: 02:59Z is still the previous local day, 03:00Z starts the next one.
const THURSDAY_MIDDAY_UTC = new Date('2026-09-24T15:00:00.000Z');
const LATE_THURSDAY_UTC = new Date('2026-09-25T02:59:00.000Z'); // UTC date 25th, Córdoba 24th
const SUNDAY_NIGHT_UTC = new Date('2026-09-28T02:59:00.000Z'); // Córdoba 2026-09-27 23:59
const MONDAY_MIDNIGHT_UTC = new Date('2026-09-28T03:00:00.000Z'); // Córdoba 2026-09-28 00:00

const NO_ACTIVITY = {
  hydration: { activeDays: 0 },
  walk: { activeDays: 0 },
  mobility: { activeDays: 0 },
  sleep: { activeDays: 0 },
};

function log(localDate: string, habitKey: string, done = true): HabitActivityLogEntry {
  return { localDate, habitKey, done };
}

describe('computeHabitActivity', () => {
  it('exposes the window contract and nothing else', () => {
    const window = computeHabitActivity({ period: 'week', today: THURSDAY, logs: [] });

    expect(Object.keys(window).sort()).toEqual([
      'activeDays',
      'days',
      'elapsedDays',
      'insightMinimumElapsedDays',
      'insightStatus',
      'perHabit',
      'period',
      'windowEnd',
      'windowStart',
    ]);
    expect(window.period).toBe('week');
    expect(window.insightMinimumElapsedDays).toBe(INSIGHT_MINIMUM_ELAPSED_DAYS);
  });

  describe('window bounds', () => {
    it('derives the week window Monday-first, identical to computeWeekConsistency', () => {
      const window = computeHabitActivity({ period: 'week', today: THURSDAY, logs: [] });
      const trainingWeek = computeWeekConsistency(THURSDAY, new Set());

      expect(window.windowStart).toBe(THURSDAY_WEEK_START);
      expect(window.windowEnd).toBe(THURSDAY_WEEK_END);
      expect(window.windowStart).toBe(trainingWeek.weekStart);
      expect(window.windowEnd).toBe(trainingWeek.weekEnd);
    });

    it('derives the week window Monday-first when today is Monday', () => {
      const window = computeHabitActivity({ period: 'week', today: MONDAY, logs: [] });
      const trainingWeek = computeWeekConsistency(MONDAY, new Set());

      expect(window.windowStart).toBe(MONDAY);
      expect(window.windowEnd).toBe(MONDAY_WEEK_END);
      expect(window.windowStart).toBe(trainingWeek.weekStart);
      expect(window.windowEnd).toBe(trainingWeek.weekEnd);
    });

    it('spans the last 30 Córdoba days including today for month', () => {
      const window = computeHabitActivity({ period: 'month', today: THURSDAY, logs: [] });

      expect(window.windowStart).toBe('2026-08-26');
      expect(window.windowEnd).toBe(THURSDAY);
      expect(window.days).toHaveLength(30);
    });

    it('spans the last 90 Córdoba days including today for quarter', () => {
      const window = computeHabitActivity({ period: 'quarter', today: THURSDAY, logs: [] });

      expect(window.windowStart).toBe('2026-06-27');
      expect(window.windowEnd).toBe(THURSDAY);
      expect(window.days).toHaveLength(90);
    });

    it('returns one ascending calendar day per day, flags only today as today', () => {
      const window = computeHabitActivity({ period: 'month', today: THURSDAY, logs: [] });
      const expectedDates = Array.from({ length: 30 }, (_, index) =>
        addLocalDateDays(window.windowStart, index)
      );

      expect(window.days.map((day) => day.localDate)).toEqual(expectedDates);
      expect(window.days.filter((day) => day.isToday).map((day) => day.localDate)).toEqual([
        THURSDAY,
      ]);
      expect(
        window.days.every((day) => day.weekdayIndex === localDateWeekdayIndex(day.localDate))
      ).toBe(true);
    });

    it('counts the inclusive window bounds and ignores the days just outside', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: SUNDAY,
        logs: [
          log('2026-09-20', 'hydration'),
          log(THURSDAY_WEEK_START, 'walk'),
          log(THURSDAY_WEEK_END, 'mobility'),
          log('2026-09-28', 'sleep'),
        ],
      });

      expect(window.activeDays).toBe(2);
      expect(window.perHabit).toEqual({
        hydration: { activeDays: 0 },
        walk: { activeDays: 1 },
        mobility: { activeDays: 1 },
        sleep: { activeDays: 0 },
      });
    });
  });

  describe('activity counting', () => {
    it('counts an empty window honestly as zero activity and insufficient', () => {
      const window = computeHabitActivity({ period: 'week', today: THURSDAY, logs: [] });

      expect(window.activeDays).toBe(0);
      expect(window.elapsedDays).toBe(THURSDAY_ELAPSED_DAYS);
      expect(window.perHabit).toEqual(NO_ACTIVITY);
      expect(Object.keys(window.perHabit)).toEqual([...HABIT_KEYS]);
      expect(window.insightStatus).toBe('insufficient');
      expect(window.days.every((day) => day.isRecorded === false)).toBe(true);
      expect(window.days.every((day) => day.recordedKeys.length === 0)).toBe(true);
    });

    it('treats done:false rows as no activity at all', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: THURSDAY,
        logs: [
          log(THURSDAY, 'hydration', false),
          log(THURSDAY_WEEK_START, 'walk', false),
          log('2026-09-22', 'sleep', false),
        ],
      });

      expect(window.activeDays).toBe(0);
      expect(window.perHabit).toEqual(NO_ACTIVITY);
      expect(window.insightStatus).toBe('insufficient');
      expect(window.days[3]).toMatchObject({ isRecorded: false, recordedKeys: [] });
    });

    it('counts a single active day', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: THURSDAY,
        logs: [log(THURSDAY, 'hydration')],
      });

      expect(window.activeDays).toBe(1);
      expect(window.days[3]).toMatchObject({
        localDate: THURSDAY,
        weekdayIndex: 3,
        isToday: true,
        isFuture: false,
        isRecorded: true,
        recordedKeys: ['hydration'],
      });
      expect(window.days[0]).toMatchObject({ isRecorded: false, recordedKeys: [] });
    });

    it('counts several active days and their per-habit totals', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: THURSDAY,
        logs: [
          log(THURSDAY_WEEK_START, 'hydration'),
          log(THURSDAY_WEEK_START, 'walk'),
          log('2026-09-22', 'hydration'),
          log('2026-09-22', 'walk'),
          log(THURSDAY, 'hydration'),
        ],
      });

      expect(window.activeDays).toBe(3);
      expect(window.elapsedDays).toBe(THURSDAY_ELAPSED_DAYS);
      expect(window.perHabit).toEqual({
        hydration: { activeDays: 3 },
        walk: { activeDays: 2 },
        mobility: { activeDays: 0 },
        sleep: { activeDays: 0 },
      });
      expect(window.insightStatus).toBe('insufficient');
    });

    it('counts four habits recorded on one day as a single active day', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: THURSDAY,
        logs: HABIT_KEYS.map((habitKey) => log(THURSDAY, habitKey)),
      });

      expect(window.activeDays).toBe(1);
      expect(window.perHabit).toEqual({
        hydration: { activeDays: 1 },
        walk: { activeDays: 1 },
        mobility: { activeDays: 1 },
        sleep: { activeDays: 1 },
      });
      expect(window.days[3].recordedKeys).toEqual([...HABIT_KEYS]);
    });

    it('counts a repeated key on the same day once', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: THURSDAY,
        logs: [log(THURSDAY, 'hydration'), log(THURSDAY, 'hydration')],
      });

      expect(window.activeDays).toBe(1);
      expect(window.perHabit.hydration).toEqual({ activeDays: 1 });
      expect(window.days[3].recordedKeys).toEqual(['hydration']);
    });

    it('reports a fully active elapsed week as available', () => {
      const logs = Array.from({ length: 7 }, (_, index) =>
        addLocalDateDays(THURSDAY_WEEK_START, index)
      ).flatMap((localDate) => HABIT_KEYS.map((habitKey) => log(localDate, habitKey)));

      const window = computeHabitActivity({ period: 'week', today: SUNDAY, logs });

      expect(window.elapsedDays).toBe(7);
      expect(window.activeDays).toBe(7);
      expect(window.perHabit).toEqual({
        hydration: { activeDays: 7 },
        walk: { activeDays: 7 },
        mobility: { activeDays: 7 },
        sleep: { activeDays: 7 },
      });
      expect(window.insightStatus).toBe('available');
    });

    it('counts every elapsed day of a fully active partial week without inventing future days', () => {
      const logs = [
        log(THURSDAY_WEEK_START, 'walk'),
        log('2026-09-22', 'walk'),
        log('2026-09-23', 'walk'),
        log(THURSDAY, 'walk'),
      ];

      const window = computeHabitActivity({ period: 'week', today: THURSDAY, logs });

      expect(window.elapsedDays).toBe(4);
      expect(window.activeDays).toBe(4);
      expect(window.insightStatus).toBe('insufficient');
    });

    it('keeps every count truthful for a 90-day window instead of truncating it', () => {
      const window = computeHabitActivity({
        period: 'quarter',
        today: THURSDAY,
        logs: [log(THURSDAY, 'sleep')],
      });

      expect(window.days).toHaveLength(90);
      expect(window.elapsedDays).toBe(90);
      expect(window.activeDays).toBe(1);
      expect(window.perHabit).toEqual({
        hydration: { activeDays: 0 },
        walk: { activeDays: 0 },
        mobility: { activeDays: 0 },
        sleep: { activeDays: 1 },
      });
      expect(window.insightStatus).toBe('available');
    });

    it('ignores habit keys outside the honest catalog', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: THURSDAY,
        logs: [log(THURSDAY, 'meditation'), log(THURSDAY, 'hydration')],
      });

      expect(window.activeDays).toBe(1);
      expect(window.days[3].recordedKeys).toEqual(['hydration']);
      expect(Object.keys(window.perHabit).sort()).toEqual([...HABIT_KEYS].sort());
    });
  });

  describe('future days', () => {
    it('excludes future days from elapsedDays and renders them inert', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: THURSDAY,
        logs: [log(THURSDAY, 'hydration'), log(THURSDAY_WEEK_END, 'walk')],
      });

      const [friday, saturday, sunday] = window.days.slice(4);
      expect(friday).toMatchObject({ localDate: '2026-09-25', isFuture: true, isRecorded: false });
      expect(saturday).toMatchObject({ localDate: SATURDAY, isFuture: true, isRecorded: false });
      expect(sunday).toMatchObject({
        localDate: SUNDAY,
        isFuture: true,
        isRecorded: false,
        recordedKeys: [],
      });
      expect(window.elapsedDays).toBe(THURSDAY_ELAPSED_DAYS);
      expect(window.activeDays).toBe(1);
      expect(window.perHabit.walk).toEqual({ activeDays: 0 });
    });

    it('marks no day as future in windows that already end today', () => {
      for (const period of ['month', 'quarter'] as const) {
        const window = computeHabitActivity({ period, today: THURSDAY, logs: [] });

        expect(window.windowEnd).toBe(THURSDAY);
        expect(window.days.every((day) => day.isFuture === false)).toBe(true);
        expect(window.elapsedDays).toBe(window.days.length);
      }
    });
  });

  describe('insight threshold', () => {
    it('reports insufficient below the minimum elapsed days', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: SATURDAY,
        logs: [log(SATURDAY, 'hydration')],
      });

      expect(window.elapsedDays).toBe(6);
      expect(window.activeDays).toBe(1);
      expect(window.insightStatus).toBe('insufficient');
    });

    it('reports available once the elapsed days reach the minimum', () => {
      const window = computeHabitActivity({
        period: 'week',
        today: SUNDAY,
        logs: [log(SUNDAY, 'hydration')],
      });

      expect(window.elapsedDays).toBe(7);
      expect(window.activeDays).toBe(1);
      expect(window.insightStatus).toBe('available');
    });

    it('reports insufficient when the window elapsed but nothing is active', () => {
      const window = computeHabitActivity({ period: 'week', today: SUNDAY, logs: [] });

      expect(window.elapsedDays).toBe(7);
      expect(window.activeDays).toBe(0);
      expect(window.insightStatus).toBe('insufficient');
    });

    it('is available for every fully elapsed window regardless of period', () => {
      for (const period of ['month', 'quarter'] as const) {
        const window = computeHabitActivity({
          period,
          today: THURSDAY,
          logs: [log('2026-08-26', 'hydration')],
        });

        expect(window.insightStatus).toBe('available');
      }
    });
  });

  describe('invalid input', () => {
    it('rejects a date that is not a Córdoba calendar date', () => {
      expect(() => computeHabitActivity({ period: 'week', today: '2026-9-4', logs: [] })).toThrow(
        /Invalid/
      );
    });

    it('rejects a period outside the supported union', () => {
      // Simulates a value reaching the core from an untrusted boundary.
      const unknownPeriod = 'decade' as unknown as 'week';

      expect(() =>
        computeHabitActivity({ period: unknownPeriod, today: THURSDAY, logs: [] })
      ).toThrow(/decade/);
    });
  });
});

describe('getHabitActivityForUser', () => {
  let userId: number;
  let otherUserId: number;

  beforeEach(async () => {
    await db.delete(habitLogs);
    await db.delete(users);

    const passwordHash = await bcrypt.hash('password123', 4);
    const inserted = await db
      .insert(users)
      .values([
        { name: 'Activity User', email: 'activity@example.com', passwordHash },
        { name: 'Other User', email: 'other-activity@example.com', passwordHash },
      ])
      .returning();

    userId = inserted[0].id;
    otherUserId = inserted[1].id;
  });

  it('aggregates the stored rows of the Córdoba window resolved from the clock', async () => {
    await db.insert(habitLogs).values([
      { userId, localDate: THURSDAY_WEEK_START, habitKey: 'hydration', done: true },
      { userId, localDate: THURSDAY_WEEK_START, habitKey: 'walk', done: false },
      { userId, localDate: '2026-09-23', habitKey: 'walk', done: true },
      { userId, localDate: THURSDAY, habitKey: 'sleep', done: true },
      { userId, localDate: '2026-09-10', habitKey: 'sleep', done: true },
      { userId, localDate: THURSDAY_WEEK_END, habitKey: 'mobility', done: true },
    ]);

    const window = await getHabitActivityForUser(userId, 'week', THURSDAY_MIDDAY_UTC);

    expect(window.windowStart).toBe(THURSDAY_WEEK_START);
    expect(window.windowEnd).toBe(THURSDAY_WEEK_END);
    expect(window.elapsedDays).toBe(THURSDAY_ELAPSED_DAYS);
    expect(window.activeDays).toBe(3);
    expect(window.perHabit).toEqual({
      hydration: { activeDays: 1 },
      walk: { activeDays: 1 },
      mobility: { activeDays: 0 },
      sleep: { activeDays: 1 },
    });
    expect(window.days[3]).toMatchObject({
      localDate: THURSDAY,
      isToday: true,
      recordedKeys: ['sleep'],
    });
  });

  it('never counts another user rows', async () => {
    await db.insert(habitLogs).values([
      { userId, localDate: THURSDAY, habitKey: 'hydration', done: true },
      { userId: otherUserId, localDate: THURSDAY, habitKey: 'walk', done: true },
      { userId: otherUserId, localDate: '2026-09-23', habitKey: 'mobility', done: true },
    ]);

    const [mine, theirs] = await Promise.all([
      getHabitActivityForUser(userId, 'week', THURSDAY_MIDDAY_UTC),
      getHabitActivityForUser(otherUserId, 'week', THURSDAY_MIDDAY_UTC),
    ]);

    expect(mine.activeDays).toBe(1);
    expect(mine.perHabit.hydration).toEqual({ activeDays: 1 });
    expect(mine.perHabit.walk).toEqual({ activeDays: 0 });
    expect(mine.days[3].recordedKeys).toEqual(['hydration']);
    expect(theirs.activeDays).toBe(2);
    expect(theirs.perHabit.hydration).toEqual({ activeDays: 0 });
    expect(theirs.perHabit.walk).toEqual({ activeDays: 1 });
    expect(theirs.days[3].recordedKeys).toEqual(['walk']);
  });

  it('resolves an instant whose UTC date differs from its Córdoba date', async () => {
    await db.insert(habitLogs).values([
      { userId, localDate: '2026-09-24', habitKey: 'hydration', done: true },
      { userId, localDate: '2026-09-25', habitKey: 'walk', done: true },
    ]);

    const window = await getHabitActivityForUser(userId, 'week', LATE_THURSDAY_UTC);

    expect(window.windowStart).toBe(THURSDAY_WEEK_START);
    expect(window.windowEnd).toBe(THURSDAY_WEEK_END);
    expect(window.perHabit).toEqual({
      hydration: { activeDays: 1 },
      walk: { activeDays: 0 },
      mobility: { activeDays: 0 },
      sleep: { activeDays: 0 },
    });
  });

  it('separates 23:59 Sunday from 00:00 Monday in Córdoba', async () => {
    await db.insert(habitLogs).values([
      { userId, localDate: SUNDAY, habitKey: 'hydration', done: true },
      { userId, localDate: MONDAY, habitKey: 'walk', done: true },
    ]);

    const sundayWindow = await getHabitActivityForUser(userId, 'week', SUNDAY_NIGHT_UTC);
    const mondayWindow = await getHabitActivityForUser(userId, 'week', MONDAY_MIDNIGHT_UTC);

    expect(sundayWindow.windowStart).toBe(THURSDAY_WEEK_START);
    expect(sundayWindow.windowEnd).toBe(SUNDAY);
    expect(sundayWindow.perHabit).toEqual({
      hydration: { activeDays: 1 },
      walk: { activeDays: 0 },
      mobility: { activeDays: 0 },
      sleep: { activeDays: 0 },
    });

    expect(mondayWindow.windowStart).toBe(MONDAY);
    expect(mondayWindow.windowEnd).toBe(MONDAY_WEEK_END);
    expect(mondayWindow.elapsedDays).toBe(MONDAY_ELAPSED_DAYS);
    expect(mondayWindow.days[0]).toMatchObject({ localDate: MONDAY, isToday: true });
    expect(mondayWindow.perHabit).toEqual({
      hydration: { activeDays: 0 },
      walk: { activeDays: 1 },
      mobility: { activeDays: 0 },
      sleep: { activeDays: 0 },
    });
  });

  it('keeps the month and quarter windows identical to the Progress windows', async () => {
    for (const period of ['month', 'quarter'] as const) {
      const activity = await getHabitActivityForUser(userId, period, THURSDAY_MIDDAY_UTC);
      const progress = await getProgressSummary(userId, period, THURSDAY_MIDDAY_UTC);

      expect(activity.windowStart).toBe(progress.fromLocalDate);
      expect(activity.windowEnd).toBe(progress.toLocalDate);
    }
  });

  it('returns an honest empty window when the user has no rows', async () => {
    const window = await getHabitActivityForUser(userId, 'quarter', THURSDAY_MIDDAY_UTC);

    expect(window.days).toHaveLength(90);
    expect(window.activeDays).toBe(0);
    expect(window.elapsedDays).toBe(90);
    expect(window.perHabit).toEqual(NO_ACTIVITY);
    expect(window.insightStatus).toBe('insufficient');
  });
});
