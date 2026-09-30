/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { deleteNoteWithReadback, deleteWorkoutWithReadback } from './cleanup';
import { classifyOrphans, type OrphanProbe } from './recovery';
import type { HttpResult } from './types';

const NOW = new Date('2026-09-30T12:00:00.000Z');

function http(status: number, headers: Record<string, string> = {}): HttpResult {
  return { status, text: '', body: null, jsonOk: true, headers: new Headers(headers) };
}

function probe(overrides: Partial<OrphanProbe> & { id: number }): OrphanProbe {
  return {
    userId: 1,
    note: null,
    routineId: 7,
    startedAt: '2026-09-30T11:59:00.000Z',
    endedAt: null,
    hasSets: false,
    ...overrides,
  };
}

describe('classifyOrphans', () => {
  it('recovers a marked active artifact including its note', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 10, note: 'ATLAS_SMOKE:old:current' })],
      activeWorkoutId: 10,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.ambiguous).toEqual([]);
    expect(plan.cleanups).toEqual([
      { workoutId: 10, reason: 'marked-active', deleteNote: true },
    ]);
  });

  it('recovers a marked completed artifact without a note delete', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 11, note: 'ATLAS_SMOKE:old:history', endedAt: '2026-09-29T00:00:00Z' })],
      activeWorkoutId: null,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.cleanups).toEqual([
      { workoutId: 11, reason: 'marked-completed', deleteNote: false },
    ]);
  });

  it('recovers a create-before-mark crash window orphan', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 12 })],
      activeWorkoutId: 12,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.cleanups).toEqual([
      { workoutId: 12, reason: 'crash-window', deleteNote: false },
    ]);
  });

  it('stops on a crash-window orphan whose routine does not match the expected system routine', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 12, routineId: 99 })],
      activeWorkoutId: 12,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.cleanups).toEqual([]);
    expect(plan.ambiguous).toEqual([{ workoutId: 12, reason: 'routine-mismatch' }]);
  });

  it('recovers a manifest-recorded unmarked stale orphan only when its routine matches', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 20, startedAt: '2026-09-30T08:00:00.000Z' })],
      activeWorkoutId: 20,
      expectedUserId: 1,
      expectedRoutineId: 7,
      trustedWorkoutIds: [20],
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.ambiguous).toEqual([]);
    expect(plan.cleanups).toEqual([
      { workoutId: 20, reason: 'manifest', deleteNote: true },
    ]);
  });

  it('stops on a manifest-recorded orphan with a mismatched routine', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 21, routineId: 99, startedAt: '2026-09-30T08:00:00.000Z' })],
      activeWorkoutId: null,
      expectedUserId: 1,
      expectedRoutineId: 7,
      trustedWorkoutIds: [21],
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.cleanups).toEqual([]);
    expect(plan.ambiguous).toEqual([{ workoutId: 21, reason: 'routine-mismatch' }]);
  });

  it('stops on an unmarked active workout outside the crash window', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 13, startedAt: '2026-09-30T08:00:00.000Z' })],
      activeWorkoutId: 13,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.cleanups).toEqual([]);
    expect(plan.ambiguous).toEqual([{ workoutId: 13, reason: 'unmarked-workout' }]);
  });

  it('stops on an unmarked active workout that has sets (possible human use)', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 14, hasSets: true })],
      activeWorkoutId: 14,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.ambiguous).toEqual([{ workoutId: 14, reason: 'unmarked-workout' }]);
  });

  it('stops on an unmarked completed workout', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 15, endedAt: '2026-09-29T00:00:00Z' })],
      activeWorkoutId: null,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.ambiguous).toEqual([{ workoutId: 15, reason: 'unmarked-workout' }]);
  });

  it('stops on an unexpected owner', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 16, userId: 99, note: 'ATLAS_SMOKE:old:current' })],
      activeWorkoutId: 16,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.cleanups).toEqual([]);
    expect(plan.ambiguous).toEqual([{ workoutId: 16, reason: 'unexpected-user' }]);
  });

  it('stops on an unknown marker', () => {
    const plan = classifyOrphans({
      probes: [probe({ id: 17, note: 'ATLAS_SMOKE:broken' })],
      activeWorkoutId: 17,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.ambiguous).toEqual([{ workoutId: 17, reason: 'unknown-marker' }]);
  });

  it('flags multiple unexpected artifacts', () => {
    const plan = classifyOrphans({
      probes: [
        probe({ id: 18, endedAt: '2026-09-29T00:00:00Z' }),
        probe({ id: 19, endedAt: '2026-09-28T00:00:00Z' }),
      ],
      activeWorkoutId: null,
      expectedUserId: 1,
      expectedRoutineId: 7,
      now: NOW,
      crashWindowMs: 300_000,
    });
    expect(plan.ambiguous).toHaveLength(2);
    expect(plan.ambiguous.every((entry) => entry.reason === 'multiple-unexpected')).toBe(true);
  });
});

describe('deleteWorkoutWithReadback', () => {
  it('accepts a 200 delete', async () => {
    const outcome = await deleteWorkoutWithReadback({
      workoutId: 1,
      deleteWorkout: async () => http(200),
      listWorkoutIds: async () => [],
    });
    expect(outcome).toBe('deleted');
  });

  it('accepts a 404 only after readback confirms absence', async () => {
    const outcome = await deleteWorkoutWithReadback({
      workoutId: 1,
      deleteWorkout: async () => http(404),
      listWorkoutIds: async () => [2, 3],
    });
    expect(outcome).toBe('absent');
  });

  it('rejects a 404 when the workout is still visible', async () => {
    await expect(
      deleteWorkoutWithReadback({
        workoutId: 1,
        deleteWorkout: async () => http(404),
        listWorkoutIds: async () => [1, 2],
      }),
    ).rejects.toThrow('still_visible');
  });

  it('rejects any other status', async () => {
    await expect(
      deleteWorkoutWithReadback({
        workoutId: 1,
        deleteWorkout: async () => http(500),
        listWorkoutIds: async () => [],
      }),
    ).rejects.toThrow('unexpected_status_500');
  });

  it('maps a 429 delete to INCOMPLETE with retry guidance', async () => {
    await expect(
      deleteWorkoutWithReadback({
        workoutId: 1,
        deleteWorkout: async () => http(429, { 'retry-after': '9' }),
        listWorkoutIds: async () => [],
      }),
    ).rejects.toMatchObject({ status: 'INCOMPLETE', retryAfterSeconds: 9 });
  });
});

describe('deleteNoteWithReadback', () => {
  const context = (currentNote: unknown): HttpResult => {
    const body = {
      workoutId: 1,
      exerciseId: 2,
      currentNote,
      lastCompletedSets: null,
    };
    return {
      status: 200,
      text: JSON.stringify(body),
      body,
      jsonOk: true,
      headers: new Headers(),
    };
  };

  it('passes when the note is gone after deletion', async () => {
    const outcome = await deleteNoteWithReadback({
      deleteNote: async () => http(200),
      readContext: async () => context(null),
    });
    expect(outcome).toBe('deleted');
  });

  it('fails when a reachable note is retained after deletion', async () => {
    await expect(
      deleteNoteWithReadback({
        deleteNote: async () => http(400),
        readContext: async () =>
          context({ id: 5, version: 1, note: 'x', userId: 1, workoutId: 1, exerciseId: 2 }),
      }),
    ).rejects.toThrow('note_still_reachable_after_delete');
  });

  it('accepts a refused delete only when the context is unreachable', async () => {
    const outcome = await deleteNoteWithReadback({
      deleteNote: async () => http(409),
      readContext: async () => http(404),
    });
    expect(outcome).toBe('unreachable');
  });

  it('maps a 429 delete to INCOMPLETE with retry guidance', async () => {
    await expect(
      deleteNoteWithReadback({
        deleteNote: async () => http(429, { 'retry-after': '4' }),
        readContext: async () => context(null),
      }),
    ).rejects.toMatchObject({ status: 'INCOMPLETE', retryAfterSeconds: 4 });
  });
});
