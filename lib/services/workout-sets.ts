import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workouts, workoutSets } from '@/lib/db/schema';
import { isUniqueConstraintError } from '@/lib/db/unique-error';
import { requireAccessibleExercise } from '@/lib/services/exercises';
import { AppError } from '@/types/errors';
import { isValidWeightKg, parseWeightKg } from '@/lib/format/weight';
import { normalizeExactDecimal } from '@/lib/progression/decimal';
import { validateSemanticCapture } from '@/lib/progression/semantics';
import type { SemanticCaptureInput, SemanticCaptureValidation } from '@/types/progression';
import type { Workout, WorkoutSet } from '@/lib/db/schema';

/**
 * The six persisted semantic columns. All six are `null` on a legacy row, which
 * must stay permanently raw/unknown; a v1 row carries the complete tuple.
 */
export interface WorkoutSetSemanticFields {
  semanticCaptureVersion: number | null;
  loadMode: string | null;
  amountBasis: string | null;
  side: string | null;
  setPurpose: string | null;
  repCountBasis: string | null;
}

export interface CreateWorkoutSetInput extends WorkoutSetSemanticFields {
  workoutId: number;
  userId: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
}

export interface UpdateWorkoutSetInput {
  setId: number;
  userId: number;
  exerciseId?: number;
  setIndex?: number;
  reps?: number;
  weightKg?: string;
  semanticCaptureVersion?: number | null;
  loadMode?: string | null;
  amountBasis?: string | null;
  side?: string | null;
  setPurpose?: string | null;
  repCountBasis?: string | null;
}

/** Reason codes from the domain capture validator. */
type CaptureFailureReason = Extract<SemanticCaptureValidation, { ok: false }>['reason'];

/** Spanish UI copy for a rejected capture; the domain owns the decision. */
function captureFailureMessage(reason: CaptureFailureReason): string {
  switch (reason) {
    case 'unsupported_capture_version':
      return 'Versión de captura no soportada. Actualizá la app para registrar la serie.';
    case 'unknown_semantics':
      return 'Faltan el modo de carga, el lado o el propósito. Actualizá la app para registrar la serie.';
    case 'invalid_semantic_combination':
      return 'La combinación de carga, lado y base elegida no es válida.';
    case 'invalid_amount':
      return 'El monto registrado o las repeticiones no son válidos para esta serie.';
  }
}

function isLegacySemanticRow(set: WorkoutSet): boolean {
  return (
    set.semanticCaptureVersion === null &&
    set.loadMode === null &&
    set.amountBasis === null &&
    set.side === null &&
    set.setPurpose === null &&
    set.repCountBasis === null
  );
}

/** Returns the six columns as stored, for building a "final tuple" on PATCH. */
function persistedSemantics(set: WorkoutSet): WorkoutSetSemanticFields {
  return {
    semanticCaptureVersion: set.semanticCaptureVersion,
    loadMode: set.loadMode,
    amountBasis: set.amountBasis,
    side: set.side,
    setPurpose: set.setPurpose,
    repCountBasis: set.repCountBasis,
  };
}

/**
 * True when the PATCH actually declares any non-null semantic value. Echoing
 * the six columns as explicit `null` on a legacy row is a no-op, not an
 * upgrade attempt; only a non-null value is rejected.
 */
function hasDeclaredSemanticInput(input: UpdateWorkoutSetInput): boolean {
  return [
    input.semanticCaptureVersion,
    input.loadMode,
    input.amountBasis,
    input.side,
    input.setPurpose,
    input.repCountBasis,
  ].some((value) => value !== undefined && value !== null);
}

function validateCapture(
  fields: WorkoutSetSemanticFields,
  weightKg: string,
  reps: number,
): SemanticCaptureValidation {
  const input: SemanticCaptureInput = { ...fields, weightKg, reps };
  return validateSemanticCapture(input);
}

function assertWorkoutAllowsSetMutation(workout: Workout, action: 'create' | 'update' | 'delete'): void {
  if (!workout.endedAt) {
    return;
  }

  if (action === 'create') {
    throw new AppError('VALIDATION', 'No puedes agregar series a un entrenamiento finalizado');
  }
  if (action === 'update') {
    throw new AppError('VALIDATION', 'No puedes modificar series de un entrenamiento finalizado');
  }
  throw new AppError('VALIDATION', 'No puedes eliminar series de un entrenamiento finalizado');
}

/**
 * Creates a new workout set with a complete v1 semantic tuple.
 *
 * Every new set must carry declared semantics: an outdated client that omits the
 * tuple receives a typed `VALIDATION` error and never silently creates an
 * all-null (legacy/unknown) row. Domain validity is delegated to
 * `validateSemanticCapture`; this service only performs lifecycle/ownership
 * checks and persistence.
 */
export async function createWorkoutSet(input: CreateWorkoutSetInput): Promise<WorkoutSet> {
  // Shape check kept at the boundary; domain validity is decided below.
  if (input.reps <= 0) {
    throw new AppError('VALIDATION', 'Las repeticiones deben ser mayor a 0');
  }

  const validation = validateCapture(input, input.weightKg, input.reps);
  if (!validation.ok) {
    throw new AppError('VALIDATION', captureFailureMessage(validation.reason));
  }

  const normalizedWeight = normalizeExactDecimal(input.weightKg);

  try {
    // Use transaction to atomically verify and insert
    const [workoutSet] = await db.transaction(async (tx) => {
      // Verify ownership and workout state within transaction
      const workout = await tx.query.workouts.findFirst({
        where: eq(workouts.id, input.workoutId),
      });

      if (!workout || workout.deletedAt) {
        throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
      }

      if (workout.userId !== input.userId) {
        throw new AppError('FORBIDDEN', 'No tienes permiso para modificar este entrenamiento');
      }

      assertWorkoutAllowsSetMutation(workout, 'create');
      await requireAccessibleExercise(input.exerciseId, input.userId);

      // Persist the canonicalized tuple; legacy all-null rows are unreachable here.
      return tx
        .insert(workoutSets)
        .values({
          workoutId: input.workoutId,
          exerciseId: input.exerciseId,
          setIndex: input.setIndex,
          reps: input.reps,
          weightKg: normalizedWeight,
          completed: true,
          semanticCaptureVersion: input.semanticCaptureVersion,
          loadMode: validation.canonical.loadMode,
          amountBasis: validation.canonical.amountBasis,
          side: validation.canonical.side,
          setPurpose: validation.canonical.setPurpose,
          repCountBasis: validation.canonical.repCountBasis,
        })
        .returning();
    });

    return workoutSet;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError('CONFLICT', 'Ya existe una serie con este índice en el entrenamiento');
    }
    throw error;
  }
}

/**
 * Updates a workout set.
 *
 * For a v1 row the complete resulting tuple is validated atomically, so changing
 * mode/side/basis/amount/purpose in isolation cannot leave an invalid row. A
 * legacy row keeps all six semantic columns `null`: nonsemantic edits are
 * permitted, but any attempt to add v1 semantics is rejected (a desired
 * declared performance is recorded as a new set).
 */
export async function updateWorkoutSet(input: UpdateWorkoutSetInput): Promise<WorkoutSet> {
  if (input.reps !== undefined && input.reps <= 0) {
    throw new AppError('VALIDATION', 'Las repeticiones deben ser mayor a 0');
  }

  // The read-modify-write runs in one transaction so the resulting tuple is
  // validated and persisted atomically; the B CHECK constraints are the final
  // backstop.
  return db.transaction(async (tx) => {
    const set = await tx.query.workoutSets.findFirst({
      where: eq(workoutSets.id, input.setId),
    });

    if (!set || set.deletedAt) {
      throw new AppError('NOT_FOUND', 'Serie no encontrada');
    }

    // Verify workout ownership
    const workout = await tx.query.workouts.findFirst({
      where: eq(workouts.id, set.workoutId),
    });

    if (!workout || workout.deletedAt) {
      throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
    }

    if (workout.userId !== input.userId) {
      throw new AppError('FORBIDDEN', 'No tienes permiso para modificar esta serie');
    }

    assertWorkoutAllowsSetMutation(workout, 'update');

    const updateData: Partial<typeof workoutSets.$inferInsert> = {};
    if (input.exerciseId !== undefined) {
      await requireAccessibleExercise(input.exerciseId, input.userId);
      updateData.exerciseId = input.exerciseId;
    }
    if (input.setIndex !== undefined) updateData.setIndex = input.setIndex;
    if (input.reps !== undefined) updateData.reps = input.reps;

    if (isLegacySemanticRow(set)) {
      if (hasDeclaredSemanticInput(input)) {
        throw new AppError(
          'VALIDATION',
          'No se puede agregar semántica v1 a una serie antigua. Registrá una serie nueva.',
        );
      }
      if (input.weightKg !== undefined) {
        if (!isValidWeightKg(input.weightKg)) {
          throw new AppError('VALIDATION', 'Peso inválido');
        }
        updateData.weightKg = parseWeightKg(input.weightKg);
      }
    } else {
      const stored = persistedSemantics(set);
      const finalFields: WorkoutSetSemanticFields = {
        semanticCaptureVersion:
          input.semanticCaptureVersion !== undefined
            ? input.semanticCaptureVersion
            : stored.semanticCaptureVersion,
        loadMode: input.loadMode !== undefined ? input.loadMode : stored.loadMode,
        amountBasis: input.amountBasis !== undefined ? input.amountBasis : stored.amountBasis,
        side: input.side !== undefined ? input.side : stored.side,
        setPurpose: input.setPurpose !== undefined ? input.setPurpose : stored.setPurpose,
        repCountBasis:
          input.repCountBasis !== undefined ? input.repCountBasis : stored.repCountBasis,
      };
      const finalReps = input.reps !== undefined ? input.reps : set.reps;
      const finalWeight = input.weightKg !== undefined ? input.weightKg : set.weightKg;

      const validation = validateCapture(finalFields, finalWeight, finalReps);
      if (!validation.ok) {
        throw new AppError('VALIDATION', captureFailureMessage(validation.reason));
      }

      updateData.weightKg = normalizeExactDecimal(finalWeight);
      updateData.semanticCaptureVersion = finalFields.semanticCaptureVersion;
      updateData.loadMode = validation.canonical.loadMode;
      updateData.amountBasis = validation.canonical.amountBasis;
      updateData.side = validation.canonical.side;
      updateData.setPurpose = validation.canonical.setPurpose;
      updateData.repCountBasis = validation.canonical.repCountBasis;
    }

    const [updated] = await tx
      .update(workoutSets)
      .set(updateData)
      .where(eq(workoutSets.id, input.setId))
      .returning();

    return updated;
  });
}

/**
 * Soft deletes a workout set
 */
export async function deleteWorkoutSet(setId: number, userId: number): Promise<void> {
  const set = await db.query.workoutSets.findFirst({
    where: eq(workoutSets.id, setId),
  });

  if (!set || set.deletedAt) {
    throw new AppError('NOT_FOUND', 'Serie no encontrada');
  }

  // Verify workout ownership
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, set.workoutId),
  });

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (workout.userId !== userId) {
    throw new AppError('FORBIDDEN', 'No tienes permiso para eliminar esta serie');
  }

  assertWorkoutAllowsSetMutation(workout, 'delete');

  await db.update(workoutSets).set({ deletedAt: new Date() }).where(eq(workoutSets.id, setId));
}

/**
 * Lists all sets for a workout, excluding soft deleted
 */
export async function listWorkoutSets(workoutId: number, userId: number): Promise<WorkoutSet[]> {
  // Verify ownership
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (workout.userId !== userId) {
    throw new AppError('FORBIDDEN', 'No tienes permiso para acceder a este entrenamiento');
  }

  return db.query.workoutSets.findMany({
    where: and(eq(workoutSets.workoutId, workoutId), isNull(workoutSets.deletedAt)),
    orderBy: (workoutSets, { asc }) => [asc(workoutSets.setIndex)],
  });
}
