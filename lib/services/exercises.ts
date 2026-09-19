import { and, eq, isNull } from 'drizzle-orm';
import {
  assertCanAccessCatalogItem,
  assertCanMutateCatalogItem,
  catalogVisibleToUser,
} from '@/lib/auth/ownership';
import { db } from '@/lib/db/client';
import { exercises, type Exercise } from '@/lib/db/schema';
import { isUniqueConstraintError } from '@/lib/db/unique-error';
import { normalizeMediaUrl } from '@/lib/validation/media-url';
import { AppError } from '@/types/errors';
import type { CreateExerciseInput, ExerciseCatalogItem, UpdateExerciseInput } from '@/types/exercise';

const EXERCISE_NOT_FOUND = 'Ejercicio no encontrado';
const EXERCISE_SYSTEM_FORBIDDEN = 'No puedes modificar un ejercicio del sistema';

function toCatalogItem(row: Exercise): ExerciseCatalogItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    muscleGroup: row.muscleGroup,
    instructions: row.instructions,
    imageUrl: row.imageUrl,
    videoUrl: row.videoUrl,
    isSystem: row.isSystem,
  };
}

function slugifyName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new AppError('VALIDATION', 'Nombre de ejercicio inválido');
  }

  return slug;
}

async function findExerciseById(exerciseId: number): Promise<Exercise | undefined> {
  return db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId),
  });
}

export async function listCatalogExercises(userId: number): Promise<Exercise[]> {
  return db.query.exercises.findMany({
    where: and(isNull(exercises.deletedAt), catalogVisibleToUser(exercises, userId)),
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function listExercises(userId: number): Promise<ExerciseCatalogItem[]> {
  const rows = await listCatalogExercises(userId);
  return rows.map(toCatalogItem);
}

export async function getExerciseById(
  exerciseId: number,
  userId: number,
): Promise<ExerciseCatalogItem> {
  const row = await findExerciseById(exerciseId);
  if (!row || row.deletedAt) {
    throw new AppError('NOT_FOUND', EXERCISE_NOT_FOUND);
  }
  assertCanAccessCatalogItem(row, userId, EXERCISE_NOT_FOUND);
  return toCatalogItem(row);
}

export async function requireAccessibleExercise(
  exerciseId: number,
  userId: number,
): Promise<Exercise> {
  const row = await findExerciseById(exerciseId);
  if (!row || row.deletedAt) {
    throw new AppError('NOT_FOUND', EXERCISE_NOT_FOUND);
  }
  assertCanAccessCatalogItem(row, userId, EXERCISE_NOT_FOUND);
  return row;
}

export async function createExercise(
  userId: number,
  input: CreateExerciseInput,
): Promise<ExerciseCatalogItem> {
  const name = input.name.trim();
  const muscleGroup = input.muscleGroup.trim();
  const instructions = input.instructions.trim();
  const slug = (input.slug?.trim() || slugifyName(name)).toLowerCase();

  if (name.length < 2) {
    throw new AppError('VALIDATION', 'El nombre debe tener al menos 2 caracteres');
  }
  if (muscleGroup.length < 2) {
    throw new AppError('VALIDATION', 'El grupo muscular debe tener al menos 2 caracteres');
  }
  if (!instructions) {
    throw new AppError('VALIDATION', 'Las instrucciones son obligatorias');
  }

  try {
    const [row] = await db
      .insert(exercises)
      .values({
        slug,
        name,
        muscleGroup,
        instructions,
        imageUrl: normalizeMediaUrl(input.imageUrl),
        videoUrl: normalizeMediaUrl(input.videoUrl),
        isSystem: false,
        userId,
      })
      .returning();

    return toCatalogItem(row);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError('CONFLICT', 'Ya existe un ejercicio con este identificador');
    }
    throw error;
  }
}

export async function updateExercise(
  exerciseId: number,
  userId: number,
  input: UpdateExerciseInput,
): Promise<ExerciseCatalogItem> {
  const row = await findExerciseById(exerciseId);
  if (!row || row.deletedAt) {
    throw new AppError('NOT_FOUND', EXERCISE_NOT_FOUND);
  }
  assertCanMutateCatalogItem(row, userId, {
    notFoundMessage: EXERCISE_NOT_FOUND,
    forbiddenMessage: EXERCISE_SYSTEM_FORBIDDEN,
  });

  const updateData: Partial<typeof exercises.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2) {
      throw new AppError('VALIDATION', 'El nombre debe tener al menos 2 caracteres');
    }
    updateData.name = name;
  }
  if (input.muscleGroup !== undefined) {
    const muscleGroup = input.muscleGroup.trim();
    if (muscleGroup.length < 2) {
      throw new AppError('VALIDATION', 'El grupo muscular debe tener al menos 2 caracteres');
    }
    updateData.muscleGroup = muscleGroup;
  }
  if (input.instructions !== undefined) {
    const instructions = input.instructions.trim();
    if (!instructions) {
      throw new AppError('VALIDATION', 'Las instrucciones son obligatorias');
    }
    updateData.instructions = instructions;
  }
  if (input.imageUrl !== undefined) updateData.imageUrl = normalizeMediaUrl(input.imageUrl);
  if (input.videoUrl !== undefined) updateData.videoUrl = normalizeMediaUrl(input.videoUrl);

  const [updated] = await db
    .update(exercises)
    .set(updateData)
    .where(eq(exercises.id, exerciseId))
    .returning();

  return toCatalogItem(updated);
}

export async function deleteExercise(exerciseId: number, userId: number): Promise<void> {
  const row = await findExerciseById(exerciseId);
  if (!row || row.deletedAt) {
    throw new AppError('NOT_FOUND', EXERCISE_NOT_FOUND);
  }
  assertCanMutateCatalogItem(row, userId, {
    notFoundMessage: EXERCISE_NOT_FOUND,
    forbiddenMessage: EXERCISE_SYSTEM_FORBIDDEN,
  });

  await db.update(exercises).set({ deletedAt: new Date() }).where(eq(exercises.id, exerciseId));
}
