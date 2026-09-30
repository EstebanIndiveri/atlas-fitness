/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';

import { runSmoke } from './runner';
import { buildMarker } from './marker';
import { createHarness, TEST_EMAIL, TEST_PASSWORD } from './testing/harness';
import type { InProcessAppOptions } from './testing/in-process-app';
import {
  listVisibleWorkoutIds,
  readNoteRow,
  readWorkoutRow,
  resetDatabase,
  seedNote,
  seedQaUser,
  seedSet,
  seedSystemRoutineWithExercise,
  seedUserRoutine,
  seedWorkout,
} from './testing/seed';

describe('runSmoke orphan recovery', () => {
  let userId: number;
  let routineId: number;
  let exerciseId: number;

  beforeEach(async () => {
    await resetDatabase();
    userId = await seedQaUser(TEST_EMAIL, TEST_PASSWORD);
    ({ routineId, exerciseId } = await seedSystemRoutineWithExercise());
  });

  it('recovers a stale marked active artifact (note + workout) before creating anything', async () => {
    const orphanId = await seedWorkout({
      userId,
      routineId,
      note: buildMarker('stalerun', 'current'),
      startedAt: new Date(Date.now() - 60_000),
    });
    await seedSet({ workoutId: orphanId, exerciseId, setIndex: 1, reps: 5, weightKg: '50' });
    await seedNote({ userId, workoutId: orphanId, exerciseId, note: 'old note' });

    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('PASS');
    expect(evidence.recoveredOrphans).toBe(1);
    expect((await readWorkoutRow(orphanId))?.deletedAt).not.toBeNull();
    expect(await readNoteRow(orphanId, exerciseId)).toBeUndefined();
    expect(await listVisibleWorkoutIds(userId)).toEqual([]);
  });

  it('recovers a create-before-mark crash-window orphan', async () => {
    const orphanId = await seedWorkout({ userId, routineId, startedAt: new Date() });

    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('PASS');
    expect(evidence.recoveredOrphans).toBe(1);
    expect((await readWorkoutRow(orphanId))?.deletedAt).not.toBeNull();
    expect(await listVisibleWorkoutIds(userId)).toEqual([]);
  });

  it('is safe to run repeatedly (idempotent cleanup)', async () => {
    const firstHarness = createHarness();
    const first = await runSmoke(firstHarness.config, { fetch: firstHarness.app.fetch });
    expect(first.overallResult).toBe('PASS');
    expect(first.recoveredOrphans).toBe(0);

    const secondHarness = createHarness();
    const second = await runSmoke(secondHarness.config, { fetch: secondHarness.app.fetch });
    expect(second.overallResult).toBe('PASS');
    expect(second.recoveredOrphans).toBe(0);
    expect(await listVisibleWorkoutIds(userId)).toEqual([]);
  });

  it('stops without deleting on an unknown marker', async () => {
    const orphanId = await seedWorkout({
      userId,
      routineId,
      note: 'ATLAS_SMOKE:broken',
      startedAt: new Date(),
    });

    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('FAIL');
    expect(evidence.cleanupResult).toMatchObject({
      status: 'FAIL',
      detail: 'ambiguous_orphans',
    });
    expect(await listVisibleWorkoutIds(userId)).toEqual([orphanId]);
  });

  it('stops when a create-before-mark orphan uses an unexpected routine', async () => {
    const otherRoutineId = await seedUserRoutine(userId);
    const orphanId = await seedWorkout({
      userId,
      routineId: otherRoutineId,
      startedAt: new Date(),
    });

    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('FAIL');
    expect(evidence.cleanupResult).toMatchObject({
      status: 'FAIL',
      detail: 'ambiguous_orphans',
    });
    expect(await listVisibleWorkoutIds(userId)).toEqual([orphanId]);
  });

  it('recovery-only mode cleans up and never creates a fixture', async () => {
    const orphanId = await seedWorkout({
      userId,
      routineId,
      note: buildMarker('recoveryonly', 'history'),
      startedAt: new Date(Date.now() - 120_000),
      endedAt: new Date(),
    });

    const { app, config } = createHarness({ config: { recoveryOnly: true } });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('PASS');
    expect(evidence.recoveredOrphans).toBe(1);
    expect(evidence.historyResult.status).toBe('SKIP');
    expect(evidence.noteResult.status).toBe('SKIP');
    expect((await readWorkoutRow(orphanId))?.deletedAt).not.toBeNull();
    const visible = await listVisibleWorkoutIds(userId);
    expect(visible).toEqual([]);
  });

  it('fails recovery-only when logout is not confirmed', async () => {
    const intercept: InProcessAppOptions['intercept'] = (_request, url) => {
      if (url.pathname === '/api/auth/logout') {
        return new Response(null, { status: 500 });
      }
      return null;
    };

    const { app, config } = createHarness({
      config: { recoveryOnly: true },
      app: { intercept },
    });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('FAIL');
    expect(evidence.cleanupResult.status).toBe('FAIL');
  });
});
