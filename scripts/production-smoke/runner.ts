import {
  buildSyntheticNote,
  buildMarker,
} from './marker';
import { CURRENT_SET, HISTORY_SET_ONE, HISTORY_SET_TWO } from './constants';
import {
  asRecord,
  parseAuthIdentity,
  parseExerciseContext,
  parseNote,
  parseStreak,
  parseWorkout,
  parseWorkoutSet,
  requireJson,
  selectSystemRoutine,
  type AuthIdentity,
  type ExerciseContext,
  type WorkoutArtifact,
  type WorkoutSetRecord,
} from './api-ops';
import { CookieJar } from './cookie-jar';
import { deleteWorkoutWithReadback } from './cleanup';
import { buildEvidence, step } from './evidence';
import { SmokeHttpClient } from './http-client';
import { generateQaRunId } from './run-id';
import { AmbiguousOrphansError, listVisibleWorkoutIds, recoverOrphans } from './recovery-exec';
import type {
  HttpResult,
  OverallResult,
  SmokeDeps,
  SmokeEvidence,
  SmokeRunConfig,
  StepResult,
} from './types';

type ResultField = 'target' | 'auth' | 'reauth' | 'history' | 'note' | 'cas' | 'cleanup';

interface RunResults {
  target: StepResult;
  auth: StepResult;
  reauth: StepResult;
  history: StepResult;
  note: StepResult;
  cas: StepResult;
  cleanup: StepResult;
}

interface RunManifest {
  aId: number | null;
  bId: number | null;
  exerciseId: number | null;
  noteId: number | null;
  noteVersion: number | null;
  aCleaned: boolean;
  bCleaned: boolean;
  cleanupRan: boolean;
}

class SmokeStop extends Error {
  constructor(
    readonly field: ResultField,
    readonly status: 'FAIL' | 'INCOMPLETE',
    readonly detail: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(detail);
    this.name = 'SmokeStop';
  }
}

const paths = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  routines: '/api/routines',
  workouts: '/api/workouts',
  active: '/api/workouts/active',
  workout: (id: number) => `/api/workouts/${id}`,
  sets: (id: number) => `/api/workouts/${id}/sets`,
  context: (id: number, exerciseId: number) =>
    `/api/workouts/${id}/exercises/${exerciseId}/context`,
  note: (id: number, exerciseId: number) =>
    `/api/workouts/${id}/exercises/${exerciseId}/note`,
  streak: '/api/stats/streak',
} as const;

function retryAfterSeconds(result: HttpResult): number | null {
  const header = result.headers.get('retry-after');
  if (!header) {
    return null;
  }
  const parsed = Number.parseInt(header, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function assertStatus(
  result: HttpResult,
  expected: readonly number[],
  field: ResultField,
  label: string,
): void {
  if (result.status === 429) {
    throw new SmokeStop(field, 'INCOMPLETE', 'rate_limited', retryAfterSeconds(result));
  }
  if (!expected.includes(result.status)) {
    throw new SmokeStop(field, 'FAIL', `${label}: unexpected_status_${result.status}`);
  }
}

function readNote(result: HttpResult, label: string) {
  const record = asRecord(requireJson(result, label), label);
  const note = parseNote(record, label);
  return note;
}

async function login(client: SmokeHttpClient, config: SmokeRunConfig): Promise<void> {
  const response = await client.post(paths.login, {
    body: { email: config.email, password: config.password },
  });
  assertStatus(response, [200], 'auth', 'login');
}

async function readIdentity(client: SmokeHttpClient): Promise<AuthIdentity> {
  const response = await client.get(paths.me);
  assertStatus(response, [200], 'auth', 'me');
  return parseAuthIdentity(requireJson(response, 'me'), 'me');
}

async function createWorkout(
  client: SmokeHttpClient,
  routineId: number,
  expectedUserId: number,
): Promise<WorkoutArtifact> {
  const response = await client.post(paths.workouts, { body: { routineId } });
  assertStatus(response, [201], 'history', 'create_workout');
  const workout = parseWorkout(requireJson(response, 'create_workout'), 'create_workout');
  if (workout.userId !== expectedUserId) {
    throw new SmokeStop('history', 'FAIL', 'unexpected_user_id');
  }
  return workout;
}

async function markWorkout(
  client: SmokeHttpClient,
  workoutId: number,
  marker: string,
  expectedUserId: number,
): Promise<void> {
  const response = await client.patch(paths.workout(workoutId), { body: { note: marker } });
  assertStatus(response, [200], 'history', 'mark_workout');
  const workout = parseWorkout(requireJson(response, 'mark_workout'), 'mark_workout');
  if (workout.userId !== expectedUserId) {
    throw new SmokeStop('history', 'FAIL', 'unexpected_user_id');
  }
  if (workout.note !== marker) {
    throw new SmokeStop('history', 'FAIL', 'marker_not_persisted');
  }
}

async function createSet(
  client: SmokeHttpClient,
  workoutId: number,
  exerciseId: number,
  set: { setIndex: number; reps: number; weightKg: string },
): Promise<WorkoutSetRecord> {
  const response = await client.post(paths.sets(workoutId), {
    body: { exerciseId, ...set },
  });
  assertStatus(response, [201], 'history', 'create_set');
  return parseWorkoutSet(requireJson(response, 'create_set'), 'create_set');
}

async function readContext(
  client: SmokeHttpClient,
  workoutId: number,
  exerciseId: number,
  field: ResultField = 'history',
): Promise<ExerciseContext> {
  const response = await client.get(paths.context(workoutId, exerciseId));
  assertStatus(response, [200], field, 'context');
  return parseExerciseContext(requireJson(response, 'context'), 'context');
}

function assertHistoryMatches(
  context: ExerciseContext,
  workoutAId: number,
  historySets: readonly WorkoutSetRecord[],
  currentSetId: number,
): void {
  if (context.currentNote !== null) {
    throw new SmokeStop('history', 'FAIL', 'current_note_present_before_write');
  }
  const lastCompleted = context.lastCompletedSets;
  if (!lastCompleted || lastCompleted.workoutId !== workoutAId) {
    throw new SmokeStop('history', 'FAIL', 'history_workout_mismatch');
  }
  if (lastCompleted.sets.length !== historySets.length) {
    throw new SmokeStop('history', 'FAIL', 'history_set_count_mismatch');
  }
  for (const expected of historySets) {
    const actual = lastCompleted.sets.find((set) => set.id === expected.id);
    if (!actual) {
      throw new SmokeStop('history', 'FAIL', 'history_set_id_missing');
    }
    if (actual.weightKg !== expected.weightKg || actual.setIndex !== expected.setIndex) {
      throw new SmokeStop('history', 'FAIL', 'history_set_value_mismatch');
    }
    if (actual.id === currentSetId) {
      throw new SmokeStop('history', 'FAIL', 'current_set_leaked_into_history');
    }
  }
}

async function logout(client: SmokeHttpClient): Promise<void> {
  const response = await client.post(paths.logout);
  assertStatus(response, [200], 'reauth', 'logout');
}

async function replayCookie(
  client: SmokeHttpClient,
  cookieHeader: string,
  field: ResultField,
): Promise<void> {
  const response = await client.get(paths.workouts, { cookieOverride: cookieHeader });
  if (response.status !== 401) {
    throw new SmokeStop(field, 'FAIL', `replay_status_${response.status}`);
  }
}

async function cleanupFixtures(
  client: SmokeHttpClient,
  manifest: RunManifest,
): Promise<StepResult> {
  manifest.cleanupRan = true;
  let ok = true;

  if (manifest.bId !== null && manifest.noteId !== null && manifest.exerciseId !== null) {
    const removal = await client.del(paths.note(manifest.bId, manifest.exerciseId), {
      body: {
        expectedNoteId: manifest.noteId,
        expectedVersion: manifest.noteVersion ?? 1,
      },
    });
    if (![200, 400, 404, 409].includes(removal.status)) {
      ok = false;
    }
  }

  for (const workoutId of [manifest.bId, manifest.aId]) {
    if (workoutId === null) {
      continue;
    }
    const alreadyCleaned = workoutId === manifest.bId ? manifest.bCleaned : manifest.aCleaned;
    if (alreadyCleaned) {
      continue;
    }
    try {
      await deleteWorkoutWithReadback({
        workoutId,
        deleteWorkout: async () => (await client.del(paths.workout(workoutId))).status,
        listWorkoutIds: () => listVisibleWorkoutIds(client),
      });
      if (workoutId === manifest.bId) {
        manifest.bCleaned = true;
      } else {
        manifest.aCleaned = true;
      }
    } catch {
      ok = false;
    }
  }

  return step(ok ? 'PASS' : 'FAIL', ok ? 'fixtures_removed' : 'cleanup_incomplete');
}

async function verifyCleanup(
  client: SmokeHttpClient,
  manifest: RunManifest,
): Promise<void> {
  const visible = await listVisibleWorkoutIds(client);
  if (manifest.aId !== null && visible.includes(manifest.aId)) {
    throw new SmokeStop('cleanup', 'FAIL', 'workout_a_still_visible');
  }
  if (manifest.bId !== null && visible.includes(manifest.bId)) {
    throw new SmokeStop('cleanup', 'FAIL', 'workout_b_still_visible');
  }
  const active = await client.get(paths.active);
  assertStatus(active, [200], 'cleanup', 'active_after_cleanup');
  if (requireJson(active, 'active') !== null) {
    throw new SmokeStop('cleanup', 'FAIL', 'active_workout_remains');
  }
  for (const workoutId of [manifest.aId, manifest.bId]) {
    if (workoutId === null) {
      continue;
    }
    const detail = await client.get(paths.workout(workoutId));
    if (detail.status !== 404) {
      throw new SmokeStop('cleanup', 'FAIL', `workout_${workoutId}_not_404`);
    }
  }
  if (manifest.bId !== null && manifest.exerciseId !== null) {
    const context = await client.get(paths.context(manifest.bId, manifest.exerciseId));
    if (context.status !== 404) {
      throw new SmokeStop('cleanup', 'FAIL', 'context_not_404_after_cleanup');
    }
  }
}

function emptyResults(): RunResults {
  return {
    target: step('SKIP'),
    auth: step('SKIP'),
    reauth: step('SKIP'),
    history: step('SKIP'),
    note: step('SKIP'),
    cas: step('SKIP'),
    cleanup: step('SKIP'),
  };
}

export async function runSmoke(
  config: SmokeRunConfig,
  deps: SmokeDeps,
): Promise<SmokeEvidence> {
  const now = deps.now ?? (() => new Date());
  const logger = deps.logger ?? (() => {});
  const startedAt = now().toISOString();
  const results = emptyResults();
  const manifest: RunManifest = {
    aId: null,
    bId: null,
    exerciseId: null,
    noteId: null,
    noteVersion: null,
    aCleaned: false,
    bCleaned: false,
    cleanupRan: false,
  };
  const jar = new CookieJar();
  const client = new SmokeHttpClient(config.baseUrl, deps.fetch, jar, logger);
  const qaRunId = config.qaRunId;

  let overall: OverallResult = 'FAIL';
  let retryAfterSecondsValue: number | null = null;
  let recoveredOrphans = 0;
  let longestStreak: number | null = null;
  let currentField: ResultField = 'target';
  let expectedUserId: number | null = null;

  try {
    currentField = 'target';
    if (config.actualReleaseSha !== config.expectedReleaseSha) {
      throw new SmokeStop('target', 'FAIL', 'release_sha_mismatch');
    }
    if (config.deploymentUrl) {
      const deploymentHost = new URL(config.deploymentUrl).host;
      if (deploymentHost !== config.expectedHost) {
        throw new SmokeStop('target', 'FAIL', 'deployment_host_mismatch');
      }
    }
    results.target = step('PASS');
    logger('smoke:target:ok');

    currentField = 'auth';
    logger('smoke:auth:login');
    await login(client, config);
    const identity = await readIdentity(client);
    if (identity.email !== config.email) {
      throw new SmokeStop('auth', 'FAIL', 'identity_email_mismatch');
    }
    expectedUserId = identity.id;
    const unauthenticated = await client.get(paths.workouts, { cookieOverride: null });
    if (unauthenticated.status !== 401) {
      throw new SmokeStop('auth', 'FAIL', 'unauthenticated_status_not_401');
    }
    results.auth = step('PASS');
    logger('smoke:auth:ok');

    currentField = 'cleanup';
    logger('smoke:recovery:start');
    recoveredOrphans = await recoverOrphans(client, {
      expectedUserId,
      now: now(),
      crashWindowMs: config.crashWindowMs,
    });
    logger(`smoke:recovery:${recoveredOrphans > 0 ? 'recovered' : 'clean'}`);

    if (config.recoveryOnly) {
      await logout(client).catch(() => undefined);
      results.cleanup = step('PASS', recoveredOrphans > 0 ? 'recovered_orphans' : 'nothing_to_recover');
      overall = 'PASS';
      logger('smoke:recovery-only:ok');
    } else {
      currentField = 'history';
      logger('smoke:history:start');
      const routines = await client.get(paths.routines);
      assertStatus(routines, [200], 'history', 'routines');
      const selection = selectSystemRoutine(requireJson(routines, 'routines'));
      if (!selection) {
        throw new SmokeStop('history', 'FAIL', 'no_system_routine');
      }
      manifest.exerciseId = selection.exerciseId;

      const workoutA = await createWorkout(client, selection.routineId, expectedUserId);
      manifest.aId = workoutA.id;
      await markWorkout(client, workoutA.id, buildMarker(qaRunId, 'history'), expectedUserId);
      const historySets = [
        await createSet(client, workoutA.id, selection.exerciseId, HISTORY_SET_ONE),
        await createSet(client, workoutA.id, selection.exerciseId, HISTORY_SET_TWO),
      ];
      const closeResponse = await client.patch(paths.workout(workoutA.id), {
        body: { endedAt: now().toISOString() },
      });
      assertStatus(closeResponse, [200], 'history', 'close_workout');

      const workoutB = await createWorkout(client, selection.routineId, expectedUserId);
      manifest.bId = workoutB.id;
      await markWorkout(client, workoutB.id, buildMarker(qaRunId, 'current'), expectedUserId);
      const currentSet = await createSet(
        client,
        workoutB.id,
        selection.exerciseId,
        CURRENT_SET,
      );

      const contextBeforeNote = await readContext(client, workoutB.id, selection.exerciseId);
      assertHistoryMatches(contextBeforeNote, workoutA.id, historySets, currentSet.id);
      results.history = step('PASS');
      logger('smoke:history:ok');

      currentField = 'note';
      const syntheticNote = buildSyntheticNote(qaRunId);
      const createNote = await client.put(paths.note(workoutB.id, selection.exerciseId), {
        body: { note: syntheticNote, expectedNoteId: null, expectedVersion: null },
      });
      assertStatus(createNote, [200, 201], 'note', 'create_note');
      const created = readNote(createNote, 'create_note');
      if (
        created.id <= 0 ||
        created.version !== 1 ||
        created.note !== syntheticNote ||
        created.workoutId !== workoutB.id ||
        created.exerciseId !== selection.exerciseId ||
        created.userId !== expectedUserId
      ) {
        throw new SmokeStop('note', 'FAIL', 'note_contract_mismatch');
      }
      manifest.noteId = created.id;
      manifest.noteVersion = created.version;

      const contextWithNote = await readContext(client, workoutB.id, selection.exerciseId);
      if (
        !contextWithNote.currentNote ||
        contextWithNote.currentNote.id !== created.id ||
        contextWithNote.currentNote.version !== created.version ||
        contextWithNote.currentNote.note !== syntheticNote
      ) {
        throw new SmokeStop('note', 'FAIL', 'note_not_reflected_in_context');
      }
      results.note = step('PASS');
      logger('smoke:note:ok');

      currentField = 'cas';
      const staleNull = await client.put(paths.note(workoutB.id, selection.exerciseId), {
        body: { note: `${syntheticNote}:stale`, expectedNoteId: null, expectedVersion: null },
      });
      if (staleNull.status !== 409) {
        throw new SmokeStop('cas', 'FAIL', `stale_null_cas_status_${staleNull.status}`);
      }
      const staleVersion = await client.put(paths.note(workoutB.id, selection.exerciseId), {
        body: {
          note: `${syntheticNote}:stale2`,
          expectedNoteId: created.id,
          expectedVersion: created.version + 5,
        },
      });
      if (staleVersion.status !== 409) {
        throw new SmokeStop('cas', 'FAIL', `stale_version_cas_status_${staleVersion.status}`);
      }
      const contextAfterStale = await readContext(client, workoutB.id, selection.exerciseId);
      if (
        !contextAfterStale.currentNote ||
        contextAfterStale.currentNote.id !== created.id ||
        contextAfterStale.currentNote.version !== created.version ||
        contextAfterStale.currentNote.note !== syntheticNote
      ) {
        throw new SmokeStop('cas', 'FAIL', 'stale_cas_mutated_note');
      }
      results.cas = step('PASS');
      logger('smoke:cas:ok');

      currentField = 'reauth';
      const firstCookie = jar.header();
      if (!firstCookie) {
        throw new SmokeStop('reauth', 'FAIL', 'missing_session_cookie');
      }
      await logout(client);
      await replayCookie(client, firstCookie, 'reauth');

      await login(client, config);
      const newCookie = jar.header();
      if (!newCookie || newCookie === firstCookie) {
        throw new SmokeStop('reauth', 'FAIL', 'session_cookie_not_rotated');
      }
      const reIdentity = await readIdentity(client);
      if (reIdentity.email !== config.email || reIdentity.id !== expectedUserId) {
        throw new SmokeStop('reauth', 'FAIL', 'relogin_identity_mismatch');
      }
      const contextAfterRelogin = await readContext(
        client,
        workoutB.id,
        selection.exerciseId,
        'reauth',
      );
      if (
        !contextAfterRelogin.currentNote ||
        contextAfterRelogin.currentNote.id !== created.id ||
        contextAfterRelogin.currentNote.version !== created.version
      ) {
        throw new SmokeStop('reauth', 'FAIL', 'note_not_persisted_after_relogin');
      }
      results.reauth = step('PASS');
      logger('smoke:reauth:ok');

      currentField = 'cleanup';
      const cleanup = await cleanupFixtures(client, manifest);
      if (cleanup.status !== 'PASS') {
        results.cleanup = cleanup;
        throw new SmokeStop('cleanup', 'FAIL', 'fixture_cleanup_failed');
      }
      await verifyCleanup(client, manifest);
      results.cleanup = step('PASS', recoveredOrphans > 0 ? 'recovered_orphans' : 'fixtures_removed');
      logger('smoke:cleanup:ok');

      const streakResponse = await client.get(paths.streak);
      assertStatus(streakResponse, [200], 'cleanup', 'streak');
      const streak = parseStreak(requireJson(streakResponse, 'streak'), 'streak');
      if (streak.currentStreak !== 0 || streak.lastActiveDate !== null) {
        throw new SmokeStop('cleanup', 'FAIL', 'streak_not_clean');
      }
      longestStreak = streak.longestStreak;

      const secondCookie = jar.header();
      if (!secondCookie) {
        throw new SmokeStop('reauth', 'FAIL', 'missing_second_session_cookie');
      }
      await logout(client);
      await replayCookie(client, secondCookie, 'reauth');

      overall = 'PASS';
      logger('smoke:overall:pass');
    }
  } catch (error) {
    if (error instanceof SmokeStop) {
      results[error.field] = step(error.status, error.detail);
      retryAfterSecondsValue = error.retryAfterSeconds;
      overall = error.status;
    } else {
      const detail =
        error instanceof AmbiguousOrphansError
          ? 'ambiguous_orphans'
          : error instanceof Error
            ? error.name
            : 'unexpected_error';
      results[currentField] = step('FAIL', detail);
      overall = 'FAIL';
    }
    logger(`smoke:overall:${overall.toLowerCase()}`);
  } finally {
    if (!config.recoveryOnly && !manifest.cleanupRan && (manifest.aId !== null || manifest.bId !== null)) {
      const bestEffort = await cleanupFixtures(client, manifest).catch(() =>
        step('FAIL', 'cleanup_error'),
      );
      if (results.cleanup.status === 'SKIP') {
        results.cleanup = bestEffort;
      }
    } else if (config.recoveryOnly && results.cleanup.status === 'PASS') {
      manifest.cleanupRan = true;
    }
  }

  const completedAt = now().toISOString();
  const evidence = buildEvidence({
    qaRunId,
    expectedReleaseSha: config.expectedReleaseSha,
    actualReleaseSha: config.actualReleaseSha,
    deploymentId: config.deploymentId,
    deploymentEnvironment: config.deploymentEnvironment,
    deploymentUrl: config.deploymentUrl,
    workflowRunId: config.workflowRunId,
    startedAt,
    completedAt,
    targetResult: results.target,
    authResult: results.auth,
    reauthResult: results.reauth,
    historyResult: results.history,
    noteResult: results.note,
    casResult: results.cas,
    cleanupResult: results.cleanup,
    retryAfterSeconds: retryAfterSecondsValue,
    recoveredOrphans,
    knownQaIdentityResidualState: { longestStreak },
    overallResult: overall,
  });

  return evidence;
}

export { generateQaRunId };
export type { SmokeEvidence };
