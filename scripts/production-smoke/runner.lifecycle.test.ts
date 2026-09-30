/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { workouts, workoutExerciseNotes, workoutSets } from '@/lib/db/schema';

import { serializeEvidence } from './evidence';
import { runSmoke } from './runner';
import { createHarness, TEST_EMAIL, TEST_PASSWORD, TEST_QA_RUN_ID } from './testing/harness';
import {
  listVisibleWorkoutIds,
  resetDatabase,
  seedQaUser,
  seedSystemRoutineWithExercise,
} from './testing/seed';

describe('runSmoke lifecycle', () => {
  let userId: number;

  beforeEach(async () => {
    await resetDatabase();
    userId = await seedQaUser(TEST_EMAIL, TEST_PASSWORD);
    await seedSystemRoutineWithExercise();
  });

  it('completes the full authenticated lifecycle and cleans up', async () => {
    const logger = jest.fn();
    const { app, config } = createHarness();

    const evidence = await runSmoke(config, { fetch: app.fetch, logger });

    expect(evidence.overallResult).toBe('PASS');
    expect(evidence.schemaVersion).toBe(1);
    expect(evidence.targetResult.status).toBe('PASS');
    expect(evidence.authResult.status).toBe('PASS');
    expect(evidence.historyResult.status).toBe('PASS');
    expect(evidence.noteResult.status).toBe('PASS');
    expect(evidence.casResult.status).toBe('PASS');
    expect(evidence.reauthResult.status).toBe('PASS');
    expect(evidence.cleanupResult.status).toBe('PASS');

    // Product-visible cleanup: no visible workouts, no active workout.
    expect(await listVisibleWorkoutIds(userId)).toEqual([]);
    const active = app.requests.find((request) => request.path === '/api/workouts/active');
    expect(active?.status).toBe(200);

    // Direct reads 404 for both soft-deleted workouts.
    const rows = await db.select().from(workouts).where(eq(workouts.userId, userId));
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.deletedAt !== null)).toBe(true);

    // The synthetic note is hard-deleted before fixture cleanup.
    expect(await db.select().from(workoutExerciseNotes)).toEqual([]);

    // Accepted residual: longestStreak may remain, current streak and last active date reset.
    expect(evidence.knownQaIdentityResidualState.longestStreak).toBeGreaterThanOrEqual(1);
  });

  it('writes only complete v1 semantics for synthetic new sets', async () => {
    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch });
    expect(evidence.overallResult).toBe('PASS');

    const sets = await db.select().from(workoutSets);
    expect(sets.length).toBeGreaterThan(0);
    for (const set of sets) {
      expect(set.semanticCaptureVersion).toBe(1);
      expect(set.loadMode).toBe('external');
      expect(set.amountBasis).toBe('total');
      expect(set.side).toBe('bilateral');
      expect(set.setPurpose).toBe('working');
      expect(set.repCountBasis).toBeNull();
    }
  });

  it('preserves exact raw decimal-string weights across the API', async () => {
    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch });
    expect(evidence.overallResult).toBe('PASS');

    const sets = await db.select().from(workoutSets);
    const weights = sets.map((set) => set.weightKg).sort();
    expect(weights).toEqual(['40', '42.5', '99']);
    expect(sets.every((set) => typeof set.weightKg === 'string')).toBe(true);
  });

  it('never logs secrets or the session cookie during a passing run', async () => {
    const logger = jest.fn();
    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch, logger });

    const logged = logger.mock.calls.flat().join(' ');
    const cookies = app.requests
      .map((request) => request.cookie)
      .filter((cookie): cookie is string => cookie !== null);

    expect(cookies.length).toBeGreaterThan(0);
    expect(logged).not.toContain(TEST_PASSWORD);
    expect(logged).not.toContain('session=');

    const serialized = serializeEvidence(evidence);
    expect(serialized).not.toContain(TEST_PASSWORD);
    expect(serialized).not.toContain(TEST_QA_RUN_ID + ':current');
    for (const cookie of cookies) {
      expect(serialized).not.toContain(cookie);
    }
  });
});
