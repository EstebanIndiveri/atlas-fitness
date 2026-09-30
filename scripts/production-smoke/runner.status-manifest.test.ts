/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';

import { runSmoke } from './runner';
import { createHarness, TEST_EMAIL, TEST_PASSWORD } from './testing/harness';
import { createMemoryManifestStore } from './testing/manifest-store';
import {
  readWorkoutRow,
  resetDatabase,
  seedQaUser,
  seedSystemRoutineWithExercise,
  seedWorkout,
} from './testing/seed';
import type { InProcessAppOptions } from './testing/in-process-app';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('runSmoke status mapping', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedQaUser(TEST_EMAIL, TEST_PASSWORD);
    await seedSystemRoutineWithExercise();
  });

  it('maps a 429 in the unauthenticated control check to INCOMPLETE', async () => {
    const intercept: InProcessAppOptions['intercept'] = (request, url) => {
      if (url.pathname === '/api/workouts' && request.method === 'GET') {
        if (!request.headers.get('cookie')) {
          return jsonResponse(429, { code: 'RATE_LIMIT' }, { 'retry-after': '11' });
        }
      }
      return null;
    };
    const { app, config } = createHarness({ app: { intercept } });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('INCOMPLETE');
    expect(evidence.retryAfterSeconds).toBe(11);
    expect(evidence.authResult).toEqual({ status: 'INCOMPLETE', detail: 'rate_limited' });
  });

  it('maps a 429 in a recovery read to INCOMPLETE', async () => {
    const intercept: InProcessAppOptions['intercept'] = (_request, url) => {
      if (url.pathname === '/api/workouts/active') {
        return jsonResponse(429, { code: 'RATE_LIMIT' }, { 'retry-after': '13' });
      }
      return null;
    };
    const { app, config } = createHarness({ app: { intercept } });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('INCOMPLETE');
    expect(evidence.retryAfterSeconds).toBe(13);
    expect(evidence.cleanupResult.status).toBe('INCOMPLETE');
  });

  it('maps a 429 in a cleanup delete to INCOMPLETE', async () => {
    const intercept: InProcessAppOptions['intercept'] = (request, url) => {
      if (request.method === 'DELETE' && /^\/api\/workouts\/\d+$/.test(url.pathname)) {
        return jsonResponse(429, { code: 'RATE_LIMIT' }, { 'retry-after': '17' });
      }
      return null;
    };
    const { app, config } = createHarness({ app: { intercept } });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('INCOMPLETE');
    expect(evidence.retryAfterSeconds).toBe(17);
    expect(evidence.cleanupResult.status).toBe('INCOMPLETE');
  });
});

describe('runSmoke cleanup note readback', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedQaUser(TEST_EMAIL, TEST_PASSWORD);
    await seedSystemRoutineWithExercise();
  });

  it('never reports PASS when a reachable note is retained after DELETE', async () => {
    const intercept: InProcessAppOptions['intercept'] = (request, url) => {
      if (request.method === 'DELETE' && /\/note$/.test(url.pathname)) {
        // Pretend the delete succeeded but leave the note reachable.
        return jsonResponse(200, { note: null });
      }
      return null;
    };
    const { app, config } = createHarness({ app: { intercept } });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('FAIL');
    expect(evidence.cleanupResult).toEqual({
      status: 'FAIL',
      detail: 'note_still_reachable_after_delete',
    });
  });
});

describe('runSmoke manifest reconciliation', () => {
  let userId: number;
  let routineId: number;
  let exerciseId: number;

  beforeEach(async () => {
    await resetDatabase();
    userId = await seedQaUser(TEST_EMAIL, TEST_PASSWORD);
    ({ routineId, exerciseId } = await seedSystemRoutineWithExercise());
  });

  it('persists a secret-free manifest and removes it after a clean run', async () => {
    const store = createMemoryManifestStore();
    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch, manifestStore: store });

    expect(evidence.overallResult).toBe('PASS');
    expect(store.writes.length).toBeGreaterThanOrEqual(2);
    expect(store.writes[0]).toMatchObject({
      expectedUserId: userId,
      routineId,
      exerciseId,
      bId: null,
    });
    expect(store.writes[1]!.bId).not.toBeNull();
    const serialized = JSON.stringify(store.writes);
    expect(serialized).not.toContain(TEST_PASSWORD);
    expect(serialized).not.toContain('set-cookie');
    expect(store.current()).toBeNull();
  });

  it('reconciles and cleans a stale manifest-recorded orphan outside the crash window', async () => {
    const orphanId = await seedWorkout({
      userId,
      routineId,
      startedAt: new Date(Date.now() - 30 * 60_000),
    });
    const store = createMemoryManifestStore({
      qaRunId: 'stale'.padEnd(32, '0'),
      expectedUserId: userId,
      routineId,
      exerciseId,
      aId: orphanId,
      bId: null,
      createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      workflowRunId: 'workflow-old',
    });

    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch, manifestStore: store });

    expect(evidence.overallResult).toBe('PASS');
    expect(evidence.recoveredOrphans).toBe(1);
    expect((await readWorkoutRow(orphanId))?.deletedAt).not.toBeNull();
    expect(store.current()).toBeNull();
  });

  it('stops when a stored manifest belongs to another QA user', async () => {
    const store = createMemoryManifestStore({
      qaRunId: 'stale'.padEnd(32, '0'),
      expectedUserId: userId + 999,
      routineId,
      exerciseId,
      aId: null,
      bId: null,
      createdAt: new Date().toISOString(),
      workflowRunId: null,
    });
    const { app, config } = createHarness();
    const evidence = await runSmoke(config, { fetch: app.fetch, manifestStore: store });

    expect(evidence.overallResult).toBe('FAIL');
    expect(evidence.cleanupResult).toEqual({
      status: 'FAIL',
      detail: 'manifest_user_mismatch',
    });
  });
});
