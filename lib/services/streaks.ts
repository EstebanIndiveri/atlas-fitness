import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  dailyCheckins,
  streakNudges,
  userStreaks,
  workouts,
} from '@/lib/db/schema';
import { addLocalDateDays, cordobaLocalDate } from '@/lib/time/cordoba';
import {
  STREAK_NUDGE_KIND,
  STREAK_NUDGE_RULE,
  type StreakNudgeRunResult,
  type StreakStats,
} from '@/types/streak';

/**
 * Active-day rule (Must). Timezone: America/Argentina/Cordoba.
 *
 * A local calendar date D is an **active day** for user U iff:
 * 1. There exists a workout owned by U with `ended_at` not null whose Córdoba
 *    local date equals D, OR
 * 2. There exists a `daily_checkins` row for U with `local_date = D`
 *    (mood already validated 1–5).
 *
 * A day counts at most once (workout + mood the same day does not double-count).
 * `current_streak` is consecutive active days ending at today if today is active,
 * otherwise ending at yesterday if yesterday is active (streak still alive until
 * midnight Córdoba). Missing a full day resets `current_streak` to 0.
 * Streak freeze is out of Must (Should) and is not implemented.
 */
export function isActiveDayFromFlags(
  hasEndedWorkoutOnDate: boolean,
  hasMoodCheckinOnDate: boolean
): boolean {
  return hasEndedWorkoutOnDate || hasMoodCheckinOnDate;
}

function countConsecutiveEndingAt(active: Set<string>, endDate: string): number {
  let count = 0;
  let cursor = endDate;
  while (active.has(cursor)) {
    count += 1;
    cursor = addLocalDateDays(cursor, -1);
  }
  return count;
}

export function computeStreakFromActiveDates(
  today: string,
  activeDates: Iterable<string>,
  previousLongest = 0
): StreakStats {
  const active = activeDates instanceof Set ? activeDates : new Set(activeDates);

  let lastActiveDate: string | null = null;
  for (const date of active) {
    if (lastActiveDate === null || date > lastActiveDate) {
      lastActiveDate = date;
    }
  }

  const yesterday = addLocalDateDays(today, -1);
  let streakEnd: string | null = null;
  if (active.has(today)) {
    streakEnd = today;
  } else if (active.has(yesterday)) {
    streakEnd = yesterday;
  }

  const currentStreak = streakEnd ? countConsecutiveEndingAt(active, streakEnd) : 0;
  const consecutiveAtLastActive = lastActiveDate
    ? countConsecutiveEndingAt(active, lastActiveDate)
    : 0;

  return {
    currentStreak,
    longestStreak: Math.max(previousLongest, currentStreak, consecutiveAtLastActive),
    lastActiveDate,
  };
}

async function loadActiveDates(userId: number): Promise<Set<string>> {
  const [endedWorkouts, checkins] = await Promise.all([
    db.query.workouts.findMany({
      where: and(
        eq(workouts.userId, userId),
        isNull(workouts.deletedAt),
        isNotNull(workouts.endedAt)
      ),
      columns: { endedAt: true },
    }),
    db.query.dailyCheckins.findMany({
      where: eq(dailyCheckins.userId, userId),
      columns: { localDate: true },
    }),
  ]);

  const dates = new Set<string>();
  for (const workout of endedWorkouts) {
    if (workout.endedAt) {
      dates.add(cordobaLocalDate(workout.endedAt));
    }
  }
  for (const checkin of checkins) {
    dates.add(checkin.localDate);
  }
  return dates;
}

export async function isActiveDay(userId: number, localDate: string): Promise<boolean> {
  const dates = await loadActiveDates(userId);
  return dates.has(localDate);
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const causeMessage = error.cause instanceof Error ? error.cause.message : '';
  return (
    error.message.includes('UNIQUE') ||
    error.message.includes('unique') ||
    causeMessage.includes('UNIQUE') ||
    causeMessage.includes('unique')
  );
}

async function upsertUserStreak(userId: number, stats: StreakStats): Promise<StreakStats> {
  const values = {
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    lastWorkoutDate: stats.lastActiveDate,
    updatedAt: new Date(),
  };

  const existing = await db.query.userStreaks.findFirst({
    where: eq(userStreaks.userId, userId),
  });

  if (existing) {
    await db.update(userStreaks).set(values).where(eq(userStreaks.userId, userId));
    return stats;
  }

  try {
    await db.insert(userStreaks).values({ userId, ...values });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      await db.update(userStreaks).set(values).where(eq(userStreaks.userId, userId));
    } else {
      throw error;
    }
  }

  return stats;
}

export async function updateStreakFromActivity(
  userId: number,
  now: Date = new Date()
): Promise<StreakStats> {
  const today = cordobaLocalDate(now);
  const activeDates = await loadActiveDates(userId);
  const existing = await db.query.userStreaks.findFirst({
    where: eq(userStreaks.userId, userId),
  });
  const stats = computeStreakFromActiveDates(
    today,
    activeDates,
    existing?.longestStreak ?? 0
  );
  return upsertUserStreak(userId, stats);
}

export async function getStreakForUser(
  userId: number,
  now: Date = new Date()
): Promise<StreakStats> {
  return updateStreakFromActivity(userId, now);
}

async function getUserIdsActiveOn(localDate: string): Promise<Set<number>> {
  const checkins = await db.query.dailyCheckins.findMany({
    where: eq(dailyCheckins.localDate, localDate),
    columns: { userId: true },
  });

  const endedWorkouts = await db.query.workouts.findMany({
    where: and(isNull(workouts.deletedAt), isNotNull(workouts.endedAt)),
    columns: { userId: true, endedAt: true },
  });

  const ids = new Set<number>();
  for (const checkin of checkins) {
    ids.add(checkin.userId);
  }
  for (const workout of endedWorkouts) {
    if (workout.endedAt && cordobaLocalDate(workout.endedAt) === localDate) {
      ids.add(workout.userId);
    }
  }
  return ids;
}

async function recordNudgeIfAbsent(
  userId: number,
  localDate: string,
  kind: string
): Promise<boolean> {
  try {
    await db.insert(streakNudges).values({ userId, localDate, kind });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return false;
    }
    throw error;
  }
}

/**
 * Nudge rule: users whose last Córdoba active day is yesterday and who are not
 * yet active today. Stores intent in `streak_nudges` (no Telegram in Phase 5).
 * Re-running the same Córdoba day is a no-op for already recorded rows.
 */
export async function runStreakNudges(now: Date = new Date()): Promise<StreakNudgeRunResult> {
  const today = cordobaLocalDate(now);
  const yesterday = addLocalDateDays(today, -1);
  const yesterdayUsers = await getUserIdsActiveOn(yesterday);
  const todayUsers = await getUserIdsActiveOn(today);

  let recorded = 0;
  let skipped = 0;
  for (const userId of yesterdayUsers) {
    if (todayUsers.has(userId)) {
      continue;
    }
    const created = await recordNudgeIfAbsent(userId, today, STREAK_NUDGE_KIND);
    if (created) {
      recorded += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    date: today,
    rule: STREAK_NUDGE_RULE,
    considered: recorded + skipped,
    recorded,
    skipped,
  };
}
