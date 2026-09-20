import { eq, and, isNull, asc } from 'drizzle-orm';
import { assertCanAccessCatalogItem, assertCanMutateCatalogItem, catalogVisibleToUser } from '@/lib/auth/ownership';
import { db } from '@/lib/db/client';
import { exercises, routineExercises, routines } from '@/lib/db/schema';
import { isUniqueConstraintError } from '@/lib/db/unique-error';
import { requireAccessibleExercise } from '@/lib/services/exercises';
import { AppError } from '@/types/errors';
import type {
  CreateRoutineInput,
  RoutineExerciseWrite,
  RoutineKind,
  RoutineSummary,
  UpdateRoutineInput,
} from '@/types/routine';

const ROUTINE_NOT_FOUND = 'Rutina no encontrada';
const ROUTINE_SYSTEM_FORBIDDEN = 'No puedes modificar una rutina del sistema';
const ROUTINE_EMPTY_EXERCISES = 'La rutina debe incluir al menos un ejercicio';
const ROUTINE_DUPLICATE_ORDER = 'El orden de los ejercicios no puede repetirse';

function asKind(value: string): RoutineKind {
  return value === 'home' ? 'home' : 'gym';
}

function slugifyName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new AppError('VALIDATION', 'Nombre de rutina inválido');
  }

  return slug;
}

function normalizeDescription(description: string | null | undefined): string | null {
  if (description === undefined || description === null) {
    return null;
  }
  const trimmed = description.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function findRoutineById(routineId: number) {
  return db.query.routines.findFirst({
    where: eq(routines.id, routineId),
  });
}

function assertRoutineExerciseItems(items: RoutineExerciseWrite[]): void {
  if (items.length === 0) {
    throw new AppError('VALIDATION', ROUTINE_EMPTY_EXERCISES);
  }

  const orders = items.map((item) => item.sortOrder);
  if (new Set(orders).size !== orders.length) {
    throw new AppError('VALIDATION', ROUTINE_DUPLICATE_ORDER);
  }

  for (const item of items) {
    if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
      throw new AppError('VALIDATION', 'El orden de los ejercicios es inválido');
    }
    if (!Number.isInteger(item.targetSets) || item.targetSets <= 0) {
      throw new AppError('VALIDATION', 'Las series objetivo deben ser mayor a 0');
    }
    if (!Number.isInteger(item.targetReps) || item.targetReps <= 0) {
      throw new AppError('VALIDATION', 'Las repeticiones objetivo deben ser mayor a 0');
    }
  }
}

async function assertAccessibleExercises(
  items: RoutineExerciseWrite[],
  userId: number,
): Promise<void> {
  assertRoutineExerciseItems(items);
  for (const item of items) {
    await requireAccessibleExercise(item.exerciseId, userId);
  }
}

async function replaceRoutineExercises(
  tx: Pick<typeof db, 'delete' | 'insert'>,
  routineId: number,
  items: RoutineExerciseWrite[],
): Promise<void> {
  await tx.delete(routineExercises).where(eq(routineExercises.routineId, routineId));
  await tx.insert(routineExercises).values(
    items.map((item) => ({
      routineId,
      exerciseId: item.exerciseId,
      sortOrder: item.sortOrder,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
    })),
  );
}

export async function listRoutines(userId: number): Promise<RoutineSummary[]> {
  const rows = await db.query.routines.findMany({
    where: and(isNull(routines.deletedAt), catalogVisibleToUser(routines, userId)),
    orderBy: [asc(routines.id)],
  });

  const result: RoutineSummary[] = [];
  for (const row of rows) {
    result.push(await loadRoutineExercises(row));
  }
  return result;
}

export async function getRoutineById(
  routineId: number,
  userId: number,
): Promise<RoutineSummary> {
  const row = await findRoutineById(routineId);

  if (!row || row.deletedAt) {
    throw new AppError('NOT_FOUND', ROUTINE_NOT_FOUND);
  }

  assertCanAccessCatalogItem(row, userId, ROUTINE_NOT_FOUND);
  return loadRoutineExercises(row);
}

export async function createRoutine(
  userId: number,
  input: CreateRoutineInput,
): Promise<RoutineSummary> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new AppError('VALIDATION', 'El nombre debe tener al menos 2 caracteres');
  }
  if (input.kind !== 'gym' && input.kind !== 'home') {
    throw new AppError('VALIDATION', 'El tipo de rutina debe ser gym o home');
  }
  const restSeconds = input.restSeconds ?? 90;
  if (!Number.isInteger(restSeconds) || restSeconds < 0) {
    throw new AppError('VALIDATION', 'El descanso debe ser un número entero mayor o igual a 0');
  }

  await assertAccessibleExercises(input.exercises, userId);

  const slug = `${slugifyName(name)}-u${userId}`;

  try {
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(routines)
        .values({
          slug,
          name,
          description: normalizeDescription(input.description),
          kind: input.kind,
          restSeconds,
          isSystem: false,
          userId,
        })
        .returning();

      await replaceRoutineExercises(tx, row.id, input.exercises);
      return row;
    });

    return loadRoutineExercises(created);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError('CONFLICT', 'Ya existe una rutina con este identificador');
    }
    throw error;
  }
}

export async function updateRoutine(
  routineId: number,
  userId: number,
  input: UpdateRoutineInput,
): Promise<RoutineSummary> {
  const row = await findRoutineById(routineId);
  if (!row || row.deletedAt) {
    throw new AppError('NOT_FOUND', ROUTINE_NOT_FOUND);
  }
  assertCanMutateCatalogItem(row, userId, {
    notFoundMessage: ROUTINE_NOT_FOUND,
    forbiddenMessage: ROUTINE_SYSTEM_FORBIDDEN,
  });

  if (input.exercises) {
    await assertAccessibleExercises(input.exercises, userId);
  }

  const updateData: Partial<typeof routines.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2) {
      throw new AppError('VALIDATION', 'El nombre debe tener al menos 2 caracteres');
    }
    updateData.name = name;
  }
  if (input.description !== undefined) {
    updateData.description = normalizeDescription(input.description);
  }
  if (input.kind !== undefined) {
    if (input.kind !== 'gym' && input.kind !== 'home') {
      throw new AppError('VALIDATION', 'El tipo de rutina debe ser gym o home');
    }
    updateData.kind = input.kind;
  }
  if (input.restSeconds !== undefined) {
    if (!Number.isInteger(input.restSeconds) || input.restSeconds < 0) {
      throw new AppError('VALIDATION', 'El descanso debe ser un número entero mayor o igual a 0');
    }
    updateData.restSeconds = input.restSeconds;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      let next = row;
      if (Object.keys(updateData).length > 0) {
        const [saved] = await tx
          .update(routines)
          .set(updateData)
          .where(eq(routines.id, routineId))
          .returning();
        next = saved;
      }
      if (input.exercises) {
        await replaceRoutineExercises(tx, routineId, input.exercises);
      }
      return next;
    });

    return loadRoutineExercises(updated);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError('VALIDATION', ROUTINE_DUPLICATE_ORDER);
    }
    throw error;
  }
}

export async function deleteRoutine(routineId: number, userId: number): Promise<void> {
  const row = await findRoutineById(routineId);
  if (!row || row.deletedAt) {
    throw new AppError('NOT_FOUND', ROUTINE_NOT_FOUND);
  }
  assertCanMutateCatalogItem(row, userId, {
    notFoundMessage: ROUTINE_NOT_FOUND,
    forbiddenMessage: ROUTINE_SYSTEM_FORBIDDEN,
  });

  await db.update(routines).set({ deletedAt: new Date() }).where(eq(routines.id, routineId));
}

async function loadRoutineExercises(
  row: typeof routines.$inferSelect,
): Promise<RoutineSummary> {
  const items = await db
    .select({
      id: routineExercises.id,
      routineId: routineExercises.routineId,
      exerciseId: routineExercises.exerciseId,
      sortOrder: routineExercises.sortOrder,
      targetSets: routineExercises.targetSets,
      targetReps: routineExercises.targetReps,
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
      instructions: exercises.instructions,
      imageUrl: exercises.imageUrl,
      videoUrl: exercises.videoUrl,
      deletedAt: exercises.deletedAt,
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
    .where(and(eq(routineExercises.routineId, row.id), isNull(exercises.deletedAt)))
    .orderBy(asc(routineExercises.sortOrder));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    kind: asKind(row.kind),
    restSeconds: row.restSeconds,
    isSystem: row.isSystem,
    exercises: items.map((item) => ({
      id: item.id,
      routineId: item.routineId,
      exerciseId: item.exerciseId,
      sortOrder: item.sortOrder,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
      exerciseName: item.exerciseName,
      muscleGroup: item.muscleGroup,
      instructions: item.instructions,
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl,
    })),
  };
}
