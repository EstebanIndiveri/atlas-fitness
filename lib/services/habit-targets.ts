import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { habitTargetDays, habitTargetSchedules } from '@/lib/db/schema';
import { isUniqueConstraintError } from '@/lib/db/unique-error';
import { addLocalDateDays, cordobaLocalDate } from '@/lib/time/cordoba';
import { HABIT_KEYS, isHabitKey } from '@/types/habit';
import { AppError } from '@/types/errors';
import { isHabitTargetWeekday } from '@/types/habit-target';
import type { HabitKey } from '@/types/habit';
import type { HabitTargetScheduleVersion, HabitTargetWeekday } from '@/types/habit-target';
import type { HabitTargetScheduleRow } from '@/lib/db/schema';

/**
 * One resolved habit target: an active (open-ended) schedule version plus the
 * weekdays it selects. This is the persistence contract consumed by the target
 * API and UI in later workstreams; it carries the concurrency token
 * `{ id, version }` but never a timestamp-as-token.
 */
export interface HabitTarget {
  id: number;
  userId: number;
  habitKey: HabitKey;
  /** Inclusive Córdoba start date (YYYY-MM-DD). */
  effectiveFrom: string;
  /** Inclusive Córdoba end date (YYYY-MM-DD), or `null` while active. */
  effectiveTo: string | null;
  /** Monotonic integer version used for compare-and-swap. */
  version: number;
  /** Selected weekdays, ascending, Sunday-first (`0 = Sunday … 6 = Saturday`). */
  weekdays: HabitTargetWeekday[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Boundary input of `putHabitTarget`. `expectedTargetId`/`expectedVersion` are
 * both `null` for a create and both present for an update; the pair is the
 * optimistic concurrency token and is strictly compared.
 */
export interface PutHabitTargetInput {
  weekdays: readonly HabitTargetWeekday[];
  expectedTargetId: number | null;
  expectedVersion: number | null;
}

/** Concurrency token of a habit target mutation: the non-reused id plus its version. */
export interface HabitTargetToken {
  targetId: number;
  version: number;
}

/** Result of a deactivation: the habit never keeps an active target after DELETE. */
export interface HabitTargetDeactivationResult {
  activeTarget: HabitTarget | null;
}

/** Executors that a transaction body may use; mirrors the repo's `Pick<typeof db, …>` style. */
type TargetWriteExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;
type TargetReadExecutor = Pick<typeof db, 'select'>;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const userIdSchema = z.number().int().positive();

const weekdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .refine((values) => new Set(values).size === values.length, { message: 'duplicate weekday' });

const putHabitTargetSchema = z
  .object({
    weekdays: weekdaysSchema,
    expectedTargetId: z.number().int().positive().nullable(),
    expectedVersion: z.number().int().min(1).nullable(),
  })
  .superRefine((value, ctx) => {
    if ((value.expectedTargetId === null) !== (value.expectedVersion === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'incomplete token', path: ['expectedVersion'] });
    }
  });

const tokenSchema = z.object({
  targetId: z.number().int().positive(),
  version: z.number().int().min(1),
});

const CONFLICT_MESSAGE = 'El objetivo de hábito cambió. Recargá e intentá de nuevo.';

function parseUserId(userId: number): number {
  const parsed = userIdSchema.safeParse(userId);

  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Usuario inválido');
  }

  return parsed.data;
}

/** Narrows a catalog key, rejecting anything outside `HABIT_KEYS` with a 404. */
function requireHabitKey(habitKey: unknown): HabitKey {
  if (!isHabitKey(habitKey)) {
    throw new AppError('NOT_FOUND', 'Hábito no encontrado');
  }

  return habitKey;
}

function assertCanonicalDate(value: string, label: string): void {
  if (!LOCAL_DATE_RE.test(value) || addLocalDateDays(value, 0) !== value) {
    throw new AppError('VALIDATION', `Fecha inválida: ${label}`);
  }
}

/** Normalizes a validated weekday list to ascending, distinct Sunday-first values. */
function toWeekdays(values: readonly number[]): HabitTargetWeekday[] {
  const weekdays: HabitTargetWeekday[] = [];

  for (const value of values) {
    if (!isHabitTargetWeekday(value)) {
      throw new AppError('VALIDATION', 'Día de la semana inválido');
    }

    weekdays.push(value);
  }

  return [...new Set(weekdays)].sort((left, right) => left - right);
}

function sameWeekdays(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort((a, b) => a - b);
  const sortedRight = [...right].sort((a, b) => a - b);

  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function toHabitTarget(row: HabitTargetScheduleRow, weekdays: HabitTargetWeekday[]): HabitTarget {
  if (!isHabitKey(row.habitKey)) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Objetivo de hábito inconsistente');
  }

  return {
    id: row.id,
    userId: row.userId,
    habitKey: row.habitKey,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    version: row.version,
    weekdays,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Loads the single active (open-ended) version of a user/habit, if any. */
async function loadActiveRow(
  executor: TargetReadExecutor,
  userId: number,
  habitKey: HabitKey,
): Promise<HabitTargetScheduleRow | undefined> {
  const [row] = await executor
    .select()
    .from(habitTargetSchedules)
    .where(
      and(
        eq(habitTargetSchedules.userId, userId),
        eq(habitTargetSchedules.habitKey, habitKey),
        isNull(habitTargetSchedules.effectiveTo),
      ),
    )
    .limit(1);

  return row;
}

/** Loads selected weekdays for the given schedule ids in one bounded query. */
async function loadWeekdaysBySchedule(
  executor: TargetReadExecutor,
  scheduleIds: readonly number[],
): Promise<Map<number, HabitTargetWeekday[]>> {
  const bySchedule = new Map<number, HabitTargetWeekday[]>();

  if (scheduleIds.length === 0) {
    return bySchedule;
  }

  const rows = await executor
    .select()
    .from(habitTargetDays)
    .where(inArray(habitTargetDays.scheduleId, [...scheduleIds]))
    .orderBy(asc(habitTargetDays.dayOfWeek));

  for (const row of rows) {
    if (!isHabitTargetWeekday(row.dayOfWeek)) {
      continue;
    }

    const weekdays = bySchedule.get(row.scheduleId) ?? [];
    weekdays.push(row.dayOfWeek);
    bySchedule.set(row.scheduleId, weekdays);
  }

  return bySchedule;
}

/** Inserts a brand-new version (version 1) with its selected days. */
async function insertVersion(
  executor: TargetWriteExecutor,
  userId: number,
  habitKey: HabitKey,
  effectiveFrom: string,
  weekdays: readonly HabitTargetWeekday[],
  timestamp: Date,
): Promise<HabitTargetScheduleRow> {
  const [row] = await executor
    .insert(habitTargetSchedules)
    .values({
      userId,
      habitKey,
      effectiveFrom,
      effectiveTo: null,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  if (row === undefined) {
    throw new AppError('SERVICE_UNAVAILABLE', 'No se pudo guardar el objetivo de hábito');
  }

  await executor.insert(habitTargetDays).values(
    weekdays.map((dayOfWeek) => ({ scheduleId: row.id, dayOfWeek })),
  );

  return row;
}

/** Replaces the days of an existing version inside the current transaction. */
async function replaceWeekdays(
  executor: TargetWriteExecutor,
  scheduleId: number,
  weekdays: readonly HabitTargetWeekday[],
): Promise<void> {
  await executor.delete(habitTargetDays).where(eq(habitTargetDays.scheduleId, scheduleId));
  await executor
    .insert(habitTargetDays)
    .values(weekdays.map((dayOfWeek) => ({ scheduleId, dayOfWeek })));
}

/**
 * Lists the user's currently active targets, in fixed catalog order.
 *
 * Only habits with a version effective on the Córdoba day of `now` are returned,
 * so an unconfigured catalog habit never appears as a daily intention. Reads have
 * no side effects and never create a target.
 *
 * @param userId - Authenticated owner of the targets.
 * @param now - Instant used to resolve the Córdoba reference day.
 * @returns Active targets ordered by `HABIT_KEYS` (empty when none).
 * @throws {AppError} VALIDATION when the user id is invalid.
 * @example
 * const targets = await listCurrentHabitTargets(1, new Date());
 */
export async function listCurrentHabitTargets(
  userId: number,
  now: Date = new Date(),
): Promise<HabitTarget[]> {
  const validUserId = parseUserId(userId);
  const today = cordobaLocalDate(now);

  const rows = await db
    .select()
    .from(habitTargetSchedules)
    .where(
      and(
        eq(habitTargetSchedules.userId, validUserId),
        lte(habitTargetSchedules.effectiveFrom, today),
        or(
          isNull(habitTargetSchedules.effectiveTo),
          gte(habitTargetSchedules.effectiveTo, today),
        ),
      ),
    );

  const weekdaysBySchedule = await loadWeekdaysBySchedule(
    db,
    rows.map((row) => row.id),
  );
  const catalogIndex = new Map(HABIT_KEYS.map((habitKey, index) => [habitKey, index]));

  return rows
    .map((row) => toHabitTarget(row, weekdaysBySchedule.get(row.id) ?? []))
    .sort(
      (left, right) =>
        (catalogIndex.get(left.habitKey) ?? 0) - (catalogIndex.get(right.habitKey) ?? 0),
    );
}

/**
 * Loads every schedule version of a user that overlaps an inclusive Córdoba
 * interval, with its selected days, in one bounded query plus one days query.
 *
 * The window semantics are the ones the pure adherence core expects: a version is
 * included when its inclusive interval intersects `[start, end]`, treating a
 * `null` end as open-ended.
 *
 * @param userId - Authenticated owner of the versions.
 * @param start - Inclusive Córdoba start date (YYYY-MM-DD).
 * @param end - Inclusive Córdoba end date (YYYY-MM-DD).
 * @returns Versions ascending by `effectiveFrom`, each with ascending weekdays.
 * @throws {AppError} VALIDATION when the user id or either date is invalid, or `end < start`.
 * @example
 * const versions = await loadHabitTargetVersionsInWindow(1, '2026-09-01', '2026-09-30');
 */
export async function loadHabitTargetVersionsInWindow(
  userId: number,
  start: string,
  end: string,
): Promise<HabitTargetScheduleVersion[]> {
  const validUserId = parseUserId(userId);
  assertCanonicalDate(start, 'start');
  assertCanonicalDate(end, 'end');

  if (end < start) {
    throw new AppError('VALIDATION', 'Rango de fechas inválido');
  }

  const rows = await db
    .select()
    .from(habitTargetSchedules)
    .where(
      and(
        eq(habitTargetSchedules.userId, validUserId),
        lte(habitTargetSchedules.effectiveFrom, end),
        or(isNull(habitTargetSchedules.effectiveTo), gte(habitTargetSchedules.effectiveTo, start)),
      ),
    )
    .orderBy(asc(habitTargetSchedules.effectiveFrom));

  const weekdaysBySchedule = await loadWeekdaysBySchedule(
    db,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    habitKey: requireHabitKey(row.habitKey),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    version: row.version,
    weekdays: weekdaysBySchedule.get(row.id) ?? [],
  }));
}

/**
 * Creates or updates the user's weekly target for one catalog habit.
 *
 * Behavior is versioned and effective today in Córdoba:
 * - with no active target a create inserts version 1 from today;
 * - a same-day PUT updates that version's days and increments its `version` in place;
 * - a later PUT closes the previous version the day before and inserts a new version
 *   from today, so earlier dates are never rewritten;
 * - an identical desired state (with a matching token) is idempotent.
 *
 * All writes run in a transaction and the row change uses compare-and-swap
 * (`WHERE id = ? AND version = ?`). A mismatch — including a token of a version that
 * is no longer active — fails with CONFLICT and leaves server state untouched.
 *
 * @param userId - Authenticated owner of the target.
 * @param habitKey - Closed-catalog habit key; unknown keys are NOT_FOUND.
 * @param input - Weekdays plus the optional `{ expectedTargetId, expectedVersion }` token.
 * @param now - Instant used to resolve "today" in Córdoba.
 * @returns The active target after the mutation.
 * @throws {AppError} VALIDATION for bad input, NOT_FOUND for an unknown habit, CONFLICT for stale state.
 * @example
 * await putHabitTarget(1, 'walk', { weekdays: [1, 3], expectedTargetId: null, expectedVersion: null });
 */
export async function putHabitTarget(
  userId: number,
  habitKey: string,
  input: unknown,
  now: Date = new Date(),
): Promise<HabitTarget> {
  const validUserId = parseUserId(userId);
  const validHabitKey = requireHabitKey(habitKey);
  const parsed = putHabitTargetSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Objetivo de hábito inválido');
  }

  const weekdays = toWeekdays(parsed.data.weekdays);
  const expectedTargetId = parsed.data.expectedTargetId;
  const expectedVersion = parsed.data.expectedVersion;
  const today = cordobaLocalDate(now);
  const timestamp = now;

  try {
    return await db.transaction(async (tx) => {
      const active = await loadActiveRow(tx, validUserId, validHabitKey);

      if (active === undefined) {
        if (expectedTargetId !== null || expectedVersion !== null) {
          throw new AppError('CONFLICT', CONFLICT_MESSAGE);
        }

        const created = await insertVersion(
          tx,
          validUserId,
          validHabitKey,
          today,
          weekdays,
          timestamp,
        );

        return toHabitTarget(created, weekdays);
      }

      const activeWeekdays = (await loadWeekdaysBySchedule(tx, [active.id])).get(active.id) ?? [];
      const tokenMatches =
        expectedTargetId === active.id && expectedVersion === active.version;

      if (sameWeekdays(activeWeekdays, weekdays)) {
        if (expectedTargetId === null || tokenMatches) {
          return toHabitTarget(active, activeWeekdays);
        }

        throw new AppError('CONFLICT', CONFLICT_MESSAGE);
      }

      if (expectedTargetId === null || !tokenMatches) {
        // A create against an existing, differently-shaped target, or a stale
        // token (including the previous version's token). Both are conflicts.
        throw new AppError('CONFLICT', CONFLICT_MESSAGE);
      }

      if (active.effectiveFrom === today) {
        const [updated] = await tx
          .update(habitTargetSchedules)
          .set({
            version: sql`${habitTargetSchedules.version} + 1`,
            updatedAt: timestamp,
          })
          .where(
            and(
              eq(habitTargetSchedules.id, active.id),
              eq(habitTargetSchedules.userId, validUserId),
              eq(habitTargetSchedules.habitKey, validHabitKey),
              eq(habitTargetSchedules.version, active.version),
              isNull(habitTargetSchedules.effectiveTo),
            ),
          )
          .returning();

        if (updated === undefined) {
          throw new AppError('CONFLICT', CONFLICT_MESSAGE);
        }

        await replaceWeekdays(tx, active.id, weekdays);

        return toHabitTarget(updated, weekdays);
      }

      const yesterday = addLocalDateDays(today, -1);
      const [closed] = await tx
        .update(habitTargetSchedules)
        .set({
          effectiveTo: yesterday,
          version: sql`${habitTargetSchedules.version} + 1`,
          updatedAt: timestamp,
        })
        .where(
          and(
            eq(habitTargetSchedules.id, active.id),
            eq(habitTargetSchedules.userId, validUserId),
            eq(habitTargetSchedules.habitKey, validHabitKey),
            eq(habitTargetSchedules.version, active.version),
            isNull(habitTargetSchedules.effectiveTo),
          ),
        )
        .returning({ id: habitTargetSchedules.id });

      if (closed === undefined) {
        throw new AppError('CONFLICT', CONFLICT_MESSAGE);
      }

      const created = await insertVersion(
        tx,
        validUserId,
        validHabitKey,
        today,
        weekdays,
        timestamp,
      );

      return toHabitTarget(created, weekdays);
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isUniqueConstraintError(error)) {
      throw new AppError('CONFLICT', CONFLICT_MESSAGE);
    }

    throw error;
  }
}

/**
 * Deactivates the user's active target for one catalog habit with compare-and-swap.
 *
 * A version created today is transactionally deleted with its days — the only
 * allowed hard delete, because it carries no earlier history. A version started
 * before today is closed the day before and its `version` incremented, so history
 * is never erased. Repeating the same DELETE over the same state returns the
 * idempotent absent state; a token that no longer matches a still-active target
 * fails with CONFLICT. `habit_logs` is never touched, so a same-day record stays
 * as extra activity.
 *
 * @param userId - Authenticated owner of the target.
 * @param habitKey - Closed-catalog habit key; unknown keys are NOT_FOUND.
 * @param expectedToken - `{ targetId, version }` captured by the client.
 * @param now - Instant used to resolve "today" in Córdoba.
 * @returns `{ activeTarget: null }` on success or when already absent.
 * @throws {AppError} VALIDATION for a malformed token, NOT_FOUND for an unknown habit, CONFLICT for stale state.
 * @example
 * await deactivateHabitTarget(1, 'walk', { targetId: 5, version: 2 });
 */
export async function deactivateHabitTarget(
  userId: number,
  habitKey: string,
  expectedToken: unknown,
  now: Date = new Date(),
): Promise<HabitTargetDeactivationResult> {
  const validUserId = parseUserId(userId);
  const validHabitKey = requireHabitKey(habitKey);
  const parsedToken = tokenSchema.safeParse(expectedToken);

  if (!parsedToken.success) {
    throw new AppError('VALIDATION', 'Token de objetivo inválido');
  }

  const { targetId, version } = parsedToken.data;
  const today = cordobaLocalDate(now);
  const timestamp = now;

  try {
    return await db.transaction(async (tx) => {
      const active = await loadActiveRow(tx, validUserId, validHabitKey);

      if (active === undefined) {
        return { activeTarget: null };
      }

      if (active.id !== targetId || active.version !== version) {
        throw new AppError('CONFLICT', CONFLICT_MESSAGE);
      }

      if (active.effectiveFrom === today) {
        await tx.delete(habitTargetDays).where(eq(habitTargetDays.scheduleId, active.id));

        const deleted = await tx
          .delete(habitTargetSchedules)
          .where(
            and(
              eq(habitTargetSchedules.id, active.id),
              eq(habitTargetSchedules.userId, validUserId),
              eq(habitTargetSchedules.habitKey, validHabitKey),
              eq(habitTargetSchedules.version, active.version),
              isNull(habitTargetSchedules.effectiveTo),
            ),
          )
          .returning({ id: habitTargetSchedules.id });

        if (deleted.length === 0) {
          throw new AppError('CONFLICT', CONFLICT_MESSAGE);
        }

        return { activeTarget: null };
      }

      const yesterday = addLocalDateDays(today, -1);
      const [closed] = await tx
        .update(habitTargetSchedules)
        .set({
          effectiveTo: yesterday,
          version: sql`${habitTargetSchedules.version} + 1`,
          updatedAt: timestamp,
        })
        .where(
          and(
            eq(habitTargetSchedules.id, active.id),
            eq(habitTargetSchedules.userId, validUserId),
            eq(habitTargetSchedules.habitKey, validHabitKey),
            eq(habitTargetSchedules.version, active.version),
            isNull(habitTargetSchedules.effectiveTo),
          ),
        )
        .returning({ id: habitTargetSchedules.id });

      if (closed === undefined) {
        throw new AppError('CONFLICT', CONFLICT_MESSAGE);
      }

      return { activeTarget: null };
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isUniqueConstraintError(error)) {
      throw new AppError('CONFLICT', CONFLICT_MESSAGE);
    }

    throw error;
  }
}
