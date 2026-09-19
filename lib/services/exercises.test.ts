/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { db } from '@/lib/db/client';
import {
  sessions,
  botMessages,
  dailyCheckins,
  exercises,
  routineExercises,
  routines,
  streakNudges,
  telegramLinkCodes,
  users,
  userStreaks,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import {
  createExercise,
  deleteExercise,
  getExerciseById,
  listExercises,
  updateExercise,
} from '@/lib/services/exercises';
import { AppError } from '@/types/errors';

async function wipe() {
  await db.delete(workoutSets);
  await db.delete(workouts);
  await db.delete(routineExercises);
  await db.delete(routines);
  await db.delete(dailyCheckins);
  await db.delete(streakNudges);
  await db.delete(userStreaks);
  await db.delete(botMessages);
  await db.delete(telegramLinkCodes);
  await db.delete(exercises);
  await db.delete(sessions);
  await db.delete(users);
}

describe('Exercises service ownership', () => {
  let ownerId: number;
  let otherId: number;
  let systemId: number;
  let ownCustomId: number;
  let foreignCustomId: number;

  beforeEach(async () => {
    await wipe();

    const [owner] = await db
      .insert(users)
      .values({ name: 'Owner', email: 'owner-ex@test.com', passwordHash: 'hash' })
      .returning();
    const [other] = await db
      .insert(users)
      .values({ name: 'Other', email: 'other-ex@test.com', passwordHash: 'hash' })
      .returning();
    ownerId = owner.id;
    otherId = other.id;

    const [system] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'Sistema',
        isSystem: true,
      })
      .returning();
    systemId = system.id;

    const [own] = await db
      .insert(exercises)
      .values({
        slug: 'owner-curl',
        name: 'Curl dueño',
        muscleGroup: 'Biceps',
        instructions: 'Custom propio',
        isSystem: false,
        userId: ownerId,
      })
      .returning();
    ownCustomId = own.id;

    const [foreign] = await db
      .insert(exercises)
      .values({
        slug: 'other-curl',
        name: 'Curl ajeno',
        muscleGroup: 'Biceps',
        instructions: 'Custom ajeno',
        isSystem: false,
        userId: otherId,
      })
      .returning();
    foreignCustomId = foreign.id;
  });

  it('lists system exercises and own customs, never foreign customs', async () => {
    const list = await listExercises(ownerId);
    const slugs = list.map((item) => item.slug).sort();
    expect(slugs).toEqual(['bench-press', 'owner-curl']);
    expect(list.every((item) => !('userId' in item))).toBe(true);
  });

  it('returns system and own custom on get', async () => {
    const system = await getExerciseById(systemId, ownerId);
    expect(system.slug).toBe('bench-press');
    expect(system.isSystem).toBe(true);

    const own = await getExerciseById(ownCustomId, ownerId);
    expect(own.slug).toBe('owner-curl');
  });

  it('throws NOT_FOUND for another user custom exercise', async () => {
    await expect(getExerciseById(foreignCustomId, ownerId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Ejercicio no encontrado',
    });
  });

  it('creates a custom exercise owned by the current user', async () => {
    const created = await createExercise(ownerId, {
      name: 'Face Pull',
      muscleGroup: 'Espalda',
      instructions: 'Tirar a la cara',
    });
    expect(created.isSystem).toBe(false);
    expect(created.slug).toBe('face-pull');
    expect(created).not.toHaveProperty('userId');

    const listed = await listExercises(otherId);
    expect(listed.map((item) => item.slug)).not.toContain('face-pull');
  });

  it('stores and updates imageUrl and videoUrl on custom exercises', async () => {
    const created = await createExercise(ownerId, {
      name: 'Pull Apart',
      muscleGroup: 'Espalda',
      instructions: 'Abrir',
      imageUrl: 'https://cdn.example.com/pull.png',
      videoUrl: 'https://youtube.com/watch?v=abc',
    });
    expect(created.imageUrl).toBe('https://cdn.example.com/pull.png');
    expect(created.videoUrl).toBe('https://youtube.com/watch?v=abc');

    const updated = await updateExercise(created.id, ownerId, {
      imageUrl: 'https://cdn.example.com/pull-v2.png',
      videoUrl: null,
    });
    expect(updated.imageUrl).toBe('https://cdn.example.com/pull-v2.png');
    expect(updated.videoUrl).toBeNull();
  });

  it('updates own custom and 404s foreign mutate', async () => {
    const updated = await updateExercise(ownCustomId, ownerId, { name: 'Curl propio' });
    expect(updated.name).toBe('Curl propio');

    await expect(updateExercise(foreignCustomId, ownerId, { name: 'Hack' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('forbids mutating a system exercise', async () => {
    await expect(updateExercise(systemId, ownerId, { name: 'Hack' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(deleteExercise(systemId, ownerId)).rejects.toBeInstanceOf(AppError);
  });

  it('soft-deletes own custom and 404s foreign delete', async () => {
    await deleteExercise(ownCustomId, ownerId);
    await expect(getExerciseById(ownCustomId, ownerId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    await expect(deleteExercise(foreignCustomId, ownerId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
