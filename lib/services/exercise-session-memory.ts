import { and, asc, desc, eq, exists, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import { canAccessCatalogItem } from '@/lib/auth/ownership';
import { db } from '@/lib/db/client';
import {
  exercises,
  routineExercises,
  workoutExerciseNotes,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import { isSqliteBusyError } from '@/lib/db/unique-error';
import { validateExerciseNote } from '@/lib/session/exercise-session-memory';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { AppError } from '@/types/errors';
import type { ExerciseSessionContext, WorkoutExerciseNote } from '@/types/exercise-session-memory';
import type {
  WorkoutExerciseNoteRow,
  Workout,
} from '@/lib/db/schema';

/**
 * Transactional exercise-session memory service (Atlas v0.11, Workstream B).
 *
 * Owns the persisted `WorkoutExerciseNote` lifecycle and the bounded read model that
 * returns the current note plus the last completed sets/note for one exact exercise.
 *
 * Data-honesty and safety rules (see the v0.11 brief §§17/21):
 * - `userId` comes only from the authenticated caller; it is never read from a body.
 * - A current note may only be created/updated/deleted while its workout is active;
 *   closing a workout freezes its notes.
 * - Historical sets/notes only come from completed (`endedAt IS NOT NULL`), non-deleted,
 *   owned workouts; an open workout never appears as `lastCompleted`.
 * - A note write touches no other domain (queue, routine, sets, plan, feedback).
 */

/** Input to create (`null`/`null`) or update (exact `{ id, version }`) a note. */
export interface PutWorkoutExerciseNoteInput {
  note: string;
  expectedNoteId: number | null;
  expectedVersion: number | null;
}

/** Result of a note PUT. `created` is true only for a fresh insert, never a retry. */
export interface PutWorkoutExerciseNoteResult {
  note: WorkoutExerciseNote;
  created: boolean;
}

/** Input to delete a note with its compare-and-swap token. */
export interface DeleteWorkoutExerciseNoteInput {
  expectedNoteId: number;
  expectedVersion: number;
}

/** Result of a note DELETE: the note is always absent afterwards. */
export interface DeleteWorkoutExerciseNoteResult {
  note: null;
}

/** Executors a transaction body may use; mirrors the repo's `Pick<typeof db, …>` style. */
type NoteExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;

const MAX_WRITE_ATTEMPTS = 3;
const CONFLICT_MESSAGE = 'La nota del ejercicio cambió. Recargá e intentá de nuevo.';
const INACTIVE_WORKOUT_MESSAGE = 'No puedes modificar la nota de un entrenamiento finalizado.';
const WORKOUT_NOT_FOUND = 'Entrenamiento no encontrado';
const WORKOUT_FORBIDDEN = 'No tienes permiso para acceder a este entrenamiento';
const EXERCISE_NOT_FOUND = 'Ejercicio no encontrado';

/** In-process per-workout write lock; mirrors `session-queue`/`guided-training-plan`. */
const noteWriteLocks = new Map<number, Promise<void>>();

const positiveIdSchema = z.number().int().positive();

const putInputSchema = z
  .object({
    note: z.unknown(),
    expectedNoteId: positiveIdSchema.nullable(),
    expectedVersion: z.number().int().min(1).nullable(),
  })
  .superRefine((value, ctx) => {
    if ((value.expectedNoteId === null) !== (value.expectedVersion === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'incomplete token', path: ['expectedVersion'] });
    }
  });

const deleteInputSchema = z.object({
  expectedNoteId: positiveIdSchema,
  expectedVersion: z.number().int().min(1),
});

function parseUserId(userId: number): number {
  const parsed = positiveIdSchema.safeParse(userId);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Usuario inválido');
  }
  return parsed.data;
}

function parseId(value: number, message: string): number {
  const parsed = positiveIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError('VALIDATION', message);
  }
  return parsed.data;
}

function toWorkoutExerciseNote(row: WorkoutExerciseNoteRow): WorkoutExerciseNote {
  return {
    id: row.id,
    userId: row.userId,
    workoutId: row.workoutId,
    exerciseId: row.exerciseId,
    note: row.note,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Loads an owned, non-deleted workout or throws the shared workout-route errors. */
async function loadOwnedWorkout(
  executor: NoteExecutor,
  userId: number,
  workoutId: number,
): Promise<Workout> {
  const [workout] = await executor
    .select()
    .from(workouts)
    .where(eq(workouts.id, workoutId))
    .limit(1);

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', WORKOUT_NOT_FOUND);
  }
  if (workout.userId !== userId) {
    throw new AppError('FORBIDDEN', WORKOUT_FORBIDDEN);
  }

  return workout;
}

function assertWorkoutActive(workout: Workout): void {
  if (workout.endedAt) {
    throw new AppError('VALIDATION', INACTIVE_WORKOUT_MESSAGE);
  }
}

/** ADR-005 accessibility: system exercises are public, custom ones belong to their owner. */
async function assertExerciseAccessible(
  executor: NoteExecutor,
  exerciseId: number,
  userId: number,
): Promise<void> {
  const [exercise] = await executor
    .select()
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .limit(1);

  if (!exercise || exercise.deletedAt || !canAccessCatalogItem(exercise, userId)) {
    throw new AppError('NOT_FOUND', EXERCISE_NOT_FOUND);
  }
}

/**
 * A note may target an exercise that belongs to the workout's routine (a skipped/held
 * item still belongs) or that already has a non-deleted set in the workout.
 */
async function assertNoteEligible(
  executor: NoteExecutor,
  workout: Workout,
  exerciseId: number,
): Promise<void> {
  if (workout.routineId !== null) {
    const [member] = await executor
      .select({ one: sql`1` })
      .from(routineExercises)
      .where(
        and(
          eq(routineExercises.routineId, workout.routineId),
          eq(routineExercises.exerciseId, exerciseId),
        ),
      )
      .limit(1);

    if (member) {
      return;
    }
  }

  const [set] = await executor
    .select({ one: sql`1` })
    .from(workoutSets)
    .where(
      and(
        eq(workoutSets.workoutId, workout.id),
        eq(workoutSets.exerciseId, exerciseId),
        isNull(workoutSets.deletedAt),
      ),
    )
    .limit(1);

  if (!set) {
    throw new AppError('NOT_FOUND', EXERCISE_NOT_FOUND);
  }
}

async function loadCurrentNoteRow(
  executor: NoteExecutor,
  workoutId: number,
  exerciseId: number,
): Promise<WorkoutExerciseNoteRow | undefined> {
  const [row] = await executor
    .select()
    .from(workoutExerciseNotes)
    .where(
      and(
        eq(workoutExerciseNotes.workoutId, workoutId),
        eq(workoutExerciseNotes.exerciseId, exerciseId),
      ),
    )
    .limit(1);

  return row;
}

/**
 * Bounded latest-set source: the completed, non-deleted, owned workout with the greatest
 * `(endedAt, id)` that contains an eligible exact-exercise set. Uses the additive
 * `workouts_user_id_ended_at_idx` plus `workout_sets_exercise_lookup_idx` (see
 * `workout-exercise-notes-query-plan.test.ts`).
 */
async function loadLastCompletedExerciseSets(
  executor: NoteExecutor,
  userId: number,
  currentWorkoutId: number,
  exerciseId: number,
): Promise<ExerciseSessionContext['lastCompletedSets']> {
  const [source] = await executor
    .select({ id: workouts.id, endedAt: workouts.endedAt })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        isNull(workouts.deletedAt),
        isNotNull(workouts.endedAt),
        ne(workouts.id, currentWorkoutId),
        exists(
          executor
            .select({ one: sql`1` })
            .from(workoutSets)
            .where(
              and(
                eq(workoutSets.exerciseId, exerciseId),
                eq(workoutSets.workoutId, workouts.id),
                isNull(workoutSets.deletedAt),
                eq(workoutSets.completed, true),
              ),
            ),
        ),
      ),
    )
    .orderBy(desc(workouts.endedAt), desc(workouts.id))
    .limit(1);

  if (!source || source.endedAt === null) {
    return null;
  }

  const sets = await executor
    .select()
    .from(workoutSets)
    .where(
      and(
        eq(workoutSets.workoutId, source.id),
        eq(workoutSets.exerciseId, exerciseId),
        isNull(workoutSets.deletedAt),
        eq(workoutSets.completed, true),
      ),
    )
    .orderBy(asc(workoutSets.setIndex), asc(workoutSets.id));

  if (sets.length === 0) {
    return null;
  }

  return {
    workoutId: source.id,
    exerciseId,
    localDate: cordobaLocalDate(source.endedAt),
    endedAt: source.endedAt.toISOString(),
    sets: sets.map((set) => ({
      id: set.id,
      exerciseId: set.exerciseId,
      setIndex: set.setIndex,
      reps: set.reps,
      weightKg: set.weightKg,
      semanticCaptureVersion: set.semanticCaptureVersion,
      loadMode: set.loadMode,
      amountBasis: set.amountBasis,
      side: set.side,
      setPurpose: set.setPurpose,
      repCountBasis: set.repCountBasis,
    })),
  };
}

/**
 * Bounded latest-note source: independent of the sets source, the completed, non-deleted,
 * owned workout with the greatest `(endedAt, id)` that contains a note for the exercise.
 */
async function loadLastCompletedExerciseNote(
  executor: NoteExecutor,
  userId: number,
  currentWorkoutId: number,
  exerciseId: number,
): Promise<ExerciseSessionContext['lastCompletedNote']> {
  const [source] = await executor
    .select({ id: workouts.id, endedAt: workouts.endedAt })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        isNull(workouts.deletedAt),
        isNotNull(workouts.endedAt),
        ne(workouts.id, currentWorkoutId),
        exists(
          executor
            .select({ one: sql`1` })
            .from(workoutExerciseNotes)
            .where(
              and(
                eq(workoutExerciseNotes.userId, userId),
                eq(workoutExerciseNotes.exerciseId, exerciseId),
                eq(workoutExerciseNotes.workoutId, workouts.id),
              ),
            ),
        ),
      ),
    )
    .orderBy(desc(workouts.endedAt), desc(workouts.id))
    .limit(1);

  if (!source || source.endedAt === null) {
    return null;
  }

  const row = await loadCurrentNoteRow(executor, source.id, exerciseId);
  if (!row) {
    return null;
  }

  return {
    workoutId: source.id,
    exerciseId,
    localDate: cordobaLocalDate(source.endedAt),
    endedAt: source.endedAt.toISOString(),
    noteId: row.id,
    note: row.note,
    version: row.version,
  };
}

/**
 * Applies the §17 PUT transition table to the persisted row.
 *
 * A conditional update that loses a race affects zero rows; that is not automatically a
 * conflict — the row is re-read in the same transaction and the table is re-applied.
 */
async function applyNotePut(
  executor: NoteExecutor,
  params: {
    userId: number;
    workoutId: number;
    exerciseId: number;
    note: string;
    expectedNoteId: number | null;
    expectedVersion: number | null;
    now: Date;
  },
): Promise<PutWorkoutExerciseNoteResult> {
  const { userId, workoutId, exerciseId, note, expectedNoteId, expectedVersion, now } = params;

  if (expectedNoteId === null) {
    const [inserted] = await executor
      .insert(workoutExerciseNotes)
      .values({ userId, workoutId, exerciseId, note, version: 1, createdAt: now, updatedAt: now })
      .onConflictDoNothing({
        target: [workoutExerciseNotes.workoutId, workoutExerciseNotes.exerciseId],
      })
      .returning();

    if (inserted) {
      return { note: toWorkoutExerciseNote(inserted), created: true };
    }

    const current = await loadCurrentNoteRow(executor, workoutId, exerciseId);
    if (current && current.note === note) {
      return { note: toWorkoutExerciseNote(current), created: false };
    }
    throw new AppError('CONFLICT', CONFLICT_MESSAGE);
  }

  if (expectedVersion === null) {
    // The input schema guarantees both token halves are present or both are null.
    throw new AppError('VALIDATION', 'Token de nota inválido');
  }

  const [updated] = await executor
    .update(workoutExerciseNotes)
    .set({ note, version: sql`${workoutExerciseNotes.version} + 1`, updatedAt: now })
    .where(
      and(
        eq(workoutExerciseNotes.id, expectedNoteId),
        eq(workoutExerciseNotes.version, expectedVersion),
        eq(workoutExerciseNotes.workoutId, workoutId),
        eq(workoutExerciseNotes.exerciseId, exerciseId),
        ne(workoutExerciseNotes.note, note),
      ),
    )
    .returning();

  if (updated) {
    return { note: toWorkoutExerciseNote(updated), created: false };
  }

  const current = await loadCurrentNoteRow(executor, workoutId, exerciseId);
  if (current && current.id === expectedNoteId && current.note === note) {
    return { note: toWorkoutExerciseNote(current), created: false };
  }
  throw new AppError('CONFLICT', CONFLICT_MESSAGE);
}

/** Serializes same-workout writes in-process; the DB CAS remains authoritative. */
async function withWorkoutNoteWriteLock<T>(
  workoutId: number,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = noteWriteLocks.get(workoutId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const lock = run.then(
    () => undefined,
    () => undefined,
  );
  noteWriteLocks.set(workoutId, lock);

  try {
    return await run;
  } finally {
    if (noteWriteLocks.get(workoutId) === lock) {
      noteWriteLocks.delete(workoutId);
    }
  }
}

/** Retries the whole transaction on local lock contention (issue #172). */
async function withNoteWriteRetries<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSqliteBusyError(error) || attempt === MAX_WRITE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new AppError('CONFLICT', CONFLICT_MESSAGE);
}

/**
 * Reads the bounded context for one exercise encounter.
 *
 * @param userId - Authenticated owner (never from a request body).
 * @param workoutId - Owned, non-deleted workout.
 * @param exerciseId - Accessible exercise eligible for this workout.
 * @returns Current note plus the independent last completed sets/note, each `null` when absent.
 * @throws {AppError} VALIDATION for bad ids, NOT_FOUND for missing/foreign access, FORBIDDEN for a foreign workout.
 * @example
 * const context = await getExerciseSessionContext(1, 7, 3);
 */
export async function getExerciseSessionContext(
  userId: number,
  workoutId: number,
  exerciseId: number,
): Promise<ExerciseSessionContext> {
  const validUserId = parseUserId(userId);
  const validWorkoutId = parseId(workoutId, 'Entrenamiento inválido');
  const validExerciseId = parseId(exerciseId, 'Ejercicio inválido');

  return db.transaction(async (tx) => {
    const workout = await loadOwnedWorkout(tx, validUserId, validWorkoutId);
    await assertExerciseAccessible(tx, validExerciseId, validUserId);
    await assertNoteEligible(tx, workout, validExerciseId);

    const current = await loadCurrentNoteRow(tx, validWorkoutId, validExerciseId);
    const lastCompletedSets = await loadLastCompletedExerciseSets(
      tx,
      validUserId,
      validWorkoutId,
      validExerciseId,
    );
    const lastCompletedNote = await loadLastCompletedExerciseNote(
      tx,
      validUserId,
      validWorkoutId,
      validExerciseId,
    );

    return {
      workoutId: validWorkoutId,
      exerciseId: validExerciseId,
      currentNote: current ? toWorkoutExerciseNote(current) : null,
      lastCompletedSets,
      lastCompletedNote,
    };
  });
}

/**
 * Creates or updates the current exercise note with compare-and-swap semantics.
 *
 * @param userId - Authenticated owner (never from a request body).
 * @param workoutId - Active, owned, non-deleted workout.
 * @param exerciseId - Accessible exercise eligible for this workout.
 * @param input - Untrusted `{ note, expectedNoteId, expectedVersion }`.
 * @returns The persisted note and whether this call created it.
 * @throws {AppError} VALIDATION for bad note/token, NOT_FOUND, FORBIDDEN, CONFLICT for stale state.
 * @example
 * await putWorkoutExerciseNote(1, 7, 3, { note: 'subir peso', expectedNoteId: null, expectedVersion: null });
 */
export async function putWorkoutExerciseNote(
  userId: number,
  workoutId: number,
  exerciseId: number,
  input: unknown,
): Promise<PutWorkoutExerciseNoteResult> {
  const validUserId = parseUserId(userId);
  const validWorkoutId = parseId(workoutId, 'Entrenamiento inválido');
  const validExerciseId = parseId(exerciseId, 'Ejercicio inválido');

  const parsed = putInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Nota inválida');
  }

  const validatedNote = validateExerciseNote(parsed.data.note);
  if (!validatedNote.ok) {
    throw new AppError('VALIDATION', 'Nota inválida');
  }

  const note = validatedNote.note;
  const expectedNoteId = parsed.data.expectedNoteId;
  const expectedVersion = parsed.data.expectedVersion;
  const now = new Date();

  return withWorkoutNoteWriteLock(validWorkoutId, () =>
    withNoteWriteRetries(() =>
      db.transaction(async (tx) => {
        const workout = await loadOwnedWorkout(tx, validUserId, validWorkoutId);
        assertWorkoutActive(workout);
        await assertExerciseAccessible(tx, validExerciseId, validUserId);
        await assertNoteEligible(tx, workout, validExerciseId);

        return applyNotePut(tx, {
          userId: validUserId,
          workoutId: validWorkoutId,
          exerciseId: validExerciseId,
          note,
          expectedNoteId,
          expectedVersion,
          now,
        });
      }),
    ),
  );
}

/**
 * Deletes the current exercise note with compare-and-swap semantics.
 *
 * @param userId - Authenticated owner (never from a request body).
 * @param workoutId - Active, owned, non-deleted workout.
 * @param exerciseId - Accessible exercise.
 * @param input - Untrusted `{ expectedNoteId, expectedVersion }`.
 * @returns `{ note: null }` on success or when no row exists.
 * @throws {AppError} VALIDATION, NOT_FOUND, FORBIDDEN, CONFLICT when a different row exists.
 * @example
 * await deleteWorkoutExerciseNote(1, 7, 3, { expectedNoteId: 4, expectedVersion: 2 });
 */
export async function deleteWorkoutExerciseNote(
  userId: number,
  workoutId: number,
  exerciseId: number,
  input: unknown,
): Promise<DeleteWorkoutExerciseNoteResult> {
  const validUserId = parseUserId(userId);
  const validWorkoutId = parseId(workoutId, 'Entrenamiento inválido');
  const validExerciseId = parseId(exerciseId, 'Ejercicio inválido');

  const parsed = deleteInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Token de nota inválido');
  }

  const { expectedNoteId, expectedVersion } = parsed.data;

  return withWorkoutNoteWriteLock(validWorkoutId, () =>
    withNoteWriteRetries(() =>
      db.transaction(async (tx) => {
        const workout = await loadOwnedWorkout(tx, validUserId, validWorkoutId);
        assertWorkoutActive(workout);
        await assertExerciseAccessible(tx, validExerciseId, validUserId);

        const deleted = await tx
          .delete(workoutExerciseNotes)
          .where(
            and(
              eq(workoutExerciseNotes.id, expectedNoteId),
              eq(workoutExerciseNotes.version, expectedVersion),
              eq(workoutExerciseNotes.workoutId, validWorkoutId),
              eq(workoutExerciseNotes.exerciseId, validExerciseId),
              eq(workoutExerciseNotes.userId, validUserId),
            ),
          )
          .returning({ id: workoutExerciseNotes.id });

        if (deleted.length > 0) {
          return { note: null };
        }

        const current = await loadCurrentNoteRow(tx, validWorkoutId, validExerciseId);
        if (!current) {
          return { note: null };
        }

        throw new AppError('CONFLICT', CONFLICT_MESSAGE);
      }),
    ),
  );
}
