import { expect, test, request as playwrightRequest } from '@playwright/test';
import type { Page } from '@playwright/test';

import { completeOnboardingForCurrentUser } from './helpers/auth';
import { expectNoHorizontalOverflow } from './helpers/viewport';

/**
 * v0.11 exercise-session memory E2E (Workstream E).
 *
 * These specs prove persisted, DB/API-backed behaviour — not render or HTTP 200
 * alone. Every scenario registers its own fresh user (see `e2e/session.spec.ts`)
 * so the shared file database cannot collide across parallel workers. The
 * `context`/`note` routes did not exist before v0.11, so the exact value
 * assertions here cannot pass without the persisted feature.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const PASSWORD = 'Test1234!';

interface RoutineExerciseDto {
  exerciseId: number;
  targetSets: number;
  targetReps: number;
}

interface RoutineDto {
  id: number;
  slug: string;
  name: string;
  exercises: RoutineExerciseDto[];
}

interface WorkoutDto {
  id: number;
  routineId: number | null;
  endedAt: string | null;
}

interface NoteDto {
  id: number;
  userId: number;
  workoutId: number;
  exerciseId: number;
  note: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface SetSnapshotDto {
  id: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
}

interface ContextDto {
  workoutId: number;
  exerciseId: number;
  currentNote: NoteDto | null;
  lastCompletedSets: {
    workoutId: number;
    exerciseId: number;
    localDate: string;
    endedAt: string;
    sets: SetSnapshotDto[];
  } | null;
  lastCompletedNote: {
    workoutId: number;
    exerciseId: number;
    localDate: string;
    endedAt: string;
    noteId: number;
    note: string;
    version: number;
  } | null;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`;
}

async function registerFreshUser(page: Page): Promise<{ email: string; password: string }> {
  const email = uniqueEmail('exercise-memory-e2e');
  await page.goto('/register');
  await page.fill('input[type="text"]', 'Exercise Memory E2E');
  await page.fill('input[type="email"]', email);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(PASSWORD);
  await passwordInputs.nth(1).fill(PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/register') && response.status() === 201,
    ),
    page.locator('button[type="submit"]').click(),
  ]);
  await completeOnboardingForCurrentUser(page);
  return { email, password: PASSWORD };
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL('/dashboard/today', { timeout: 15000 }),
    page.getByRole('button', { name: 'Ingresar' }).click(),
  ]);
}

async function listRoutines(page: Page): Promise<RoutineDto[]> {
  const response = await page.request.get('/api/routines');
  expect(response.status()).toBe(200);
  return (await response.json()) as RoutineDto[];
}

async function firstRoutineWith(page: Page, minExercises: number): Promise<RoutineDto> {
  const routines = await listRoutines(page);
  const routine = routines.find((candidate) => candidate.exercises.length >= minExercises);
  expect(routine, `seeded routine with >=${minExercises} exercises`).toBeTruthy();
  return routine as RoutineDto;
}

async function startGuidedWorkout(page: Page, routineId: number): Promise<WorkoutDto> {
  const response = await page.request.post('/api/workouts', { data: { routineId } });
  expect(response.status()).toBe(201);
  const workout = (await response.json()) as WorkoutDto;
  expect(workout.id).toBeGreaterThan(0);
  return workout;
}

async function logSet(
  page: Page,
  workoutId: number,
  exerciseId: number,
  setIndex: number,
  reps: number,
  weightKg: string,
): Promise<void> {
  const response = await page.request.post(`/api/workouts/${workoutId}/sets`, {
    data: { exerciseId, setIndex, reps, weightKg },
  });
  expect(response.status()).toBe(201);
}

async function closeWorkout(page: Page, workoutId: number): Promise<void> {
  const response = await page.request.patch(`/api/workouts/${workoutId}`, {
    data: { endedAt: new Date().toISOString() },
  });
  expect(response.status()).toBe(200);
}

function noteUrl(workoutId: number, exerciseId: number): string {
  return `/api/workouts/${workoutId}/exercises/${exerciseId}/note`;
}

function contextUrl(workoutId: number, exerciseId: number): string {
  return `/api/workouts/${workoutId}/exercises/${exerciseId}/context`;
}

async function getContext(
  page: Page,
  workoutId: number,
  exerciseId: number,
): Promise<ContextDto> {
  const response = await page.request.get(contextUrl(workoutId, exerciseId));
  expect(response.status()).toBe(200);
  return (await response.json()) as ContextDto;
}

async function openNotesPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Mostrar notas' }).click();
  await expect(page.getByTestId('exercise-note-input')).toBeVisible();
}

async function openLastTimePanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Mostrar última vez' }).click();
  await expect(page.getByTestId('last-time-panel')).toBeVisible();
}

test.describe('Exercise-session memory (v0.11)', () => {
  test('note persists with exact version across update, reload and re-auth; stale CAS is 409', async ({
    page,
  }) => {
    const credentials = await registerFreshUser(page);
    const routine = await firstRoutineWith(page, 1);
    const exerciseId = routine.exercises[0].exerciseId;
    const workout = await startGuidedWorkout(page, routine.id);

    // Truthful empty state: no note, no fabricated history.
    const initial = await getContext(page, workout.id, exerciseId);
    expect(initial.currentNote).toBeNull();
    expect(initial.lastCompletedSets).toBeNull();
    expect(initial.lastCompletedNote).toBeNull();

    // Create: exact row/version from the server.
    const createdResponse = await page.request.put(noteUrl(workout.id, exerciseId), {
      data: { note: 'nota uno', expectedNoteId: null, expectedVersion: null },
    });
    expect(createdResponse.status()).toBe(201);
    const created = (await createdResponse.json()) as NoteDto;
    expect(created).toMatchObject({
      note: 'nota uno',
      version: 1,
      workoutId: workout.id,
      exerciseId,
    });
    expect(Number.isInteger(created.id)).toBe(true);
    expect(created.userId).toBeGreaterThan(0);

    const afterCreate = await getContext(page, workout.id, exerciseId);
    expect(afterCreate.currentNote).toMatchObject({
      id: created.id,
      note: 'nota uno',
      version: 1,
    });

    // Update with the exact CAS pair: same row, version bumped, exact new text.
    const updatedResponse = await page.request.put(noteUrl(workout.id, exerciseId), {
      data: { note: 'nota dos', expectedNoteId: created.id, expectedVersion: 1 },
    });
    expect(updatedResponse.status()).toBe(200);
    const updated = (await updatedResponse.json()) as NoteDto;
    expect(updated).toMatchObject({ id: created.id, note: 'nota dos', version: 2 });

    const afterUpdate = await getContext(page, workout.id, exerciseId);
    expect(afterUpdate.currentNote).toMatchObject({
      id: created.id,
      note: 'nota dos',
      version: 2,
    });

    // Reload: the saved note comes back from the API, not local component state.
    await page.goto(`/dashboard/session/${workout.id}`);
    await openNotesPanel(page);
    await expect(page.getByTestId('exercise-note-input')).toHaveValue('nota dos');
    await page.reload();
    await openNotesPanel(page);
    await expect(page.getByTestId('exercise-note-input')).toHaveValue('nota dos');
    const afterReload = await getContext(page, workout.id, exerciseId);
    expect(afterReload.currentNote).toMatchObject({ note: 'nota dos', version: 2 });

    // Stale CAS: a stale {id,version} with different text is rejected and the
    // server truth is retained.
    const staleResponse = await page.request.put(noteUrl(workout.id, exerciseId), {
      data: { note: 'texto viejo', expectedNoteId: created.id, expectedVersion: 1 },
    });
    expect(staleResponse.status()).toBe(409);
    expect(await staleResponse.json()).toMatchObject({ code: 'CONFLICT' });
    const afterConflict = await getContext(page, workout.id, exerciseId);
    expect(afterConflict.currentNote).toMatchObject({
      id: created.id,
      note: 'nota dos',
      version: 2,
    });

    // Re-auth: log out and back in as the same user; the note is still there.
    const logout = await page.request.post('/api/auth/logout');
    expect(logout.status()).toBe(200);
    await login(page, credentials.email, credentials.password);
    const afterReauth = await getContext(page, workout.id, exerciseId);
    expect(afterReauth.currentNote).toMatchObject({
      id: created.id,
      note: 'nota dos',
      version: 2,
    });
  });

  test('last completed sets come from the closed workout as raw values and exclude the current workout', async ({
    page,
  }) => {
    await registerFreshUser(page);
    const routine = await firstRoutineWith(page, 1);
    const exerciseId = routine.exercises[0].exerciseId;

    // Completed encounter A with exact raw sets.
    const workoutA = await startGuidedWorkout(page, routine.id);
    await logSet(page, workoutA.id, exerciseId, 1, 8, '42.5');
    await logSet(page, workoutA.id, exerciseId, 2, 10, '40');
    await closeWorkout(page, workoutA.id);

    // Current open encounter B with different raw values.
    const workoutB = await startGuidedWorkout(page, routine.id);
    await logSet(page, workoutB.id, exerciseId, 1, 3, '99');

    const context = await getContext(page, workoutB.id, exerciseId);

    expect(context.lastCompletedSets).not.toBeNull();
    expect(context.lastCompletedSets?.workoutId).toBe(workoutA.id);
    expect(context.lastCompletedSets?.workoutId).not.toBe(workoutB.id);
    expect(context.lastCompletedSets?.exerciseId).toBe(exerciseId);

    const rawSets = (context.lastCompletedSets?.sets ?? []).map((set) => ({
      setIndex: set.setIndex,
      reps: set.reps,
      weightKg: set.weightKg,
    }));
    expect(rawSets).toEqual([
      { setIndex: 1, reps: 8, weightKg: '42.5' },
      { setIndex: 2, reps: 10, weightKg: '40' },
    ]);
    for (const set of context.lastCompletedSets?.sets ?? []) {
      expect(typeof set.weightKg).toBe('string');
      expect(set.id).toBeGreaterThan(0);
    }
    // The current workout's set (reps 3, 99 kg) never appears as previous.
    expect(rawSets.some((set) => set.reps === 3 || set.weightKg === '99')).toBe(false);
    expect(context.lastCompletedNote).toBeNull();
  });

  test('a closed workout freezes its note: PUT/DELETE are rejected and the row is unchanged', async ({
    page,
  }) => {
    await registerFreshUser(page);
    const routine = await firstRoutineWith(page, 1);
    const exerciseId = routine.exercises[0].exerciseId;
    const workout = await startGuidedWorkout(page, routine.id);

    const createdResponse = await page.request.put(noteUrl(workout.id, exerciseId), {
      data: { note: 'nota congelada', expectedNoteId: null, expectedVersion: null },
    });
    expect(createdResponse.status()).toBe(201);
    const created = (await createdResponse.json()) as NoteDto;

    await closeWorkout(page, workout.id);

    const rejectedPut = await page.request.put(noteUrl(workout.id, exerciseId), {
      data: { note: 'intento post cierre', expectedNoteId: created.id, expectedVersion: 1 },
    });
    expect(rejectedPut.status()).toBe(400);
    expect(await rejectedPut.json()).toMatchObject({ code: 'VALIDATION' });

    const rejectedDelete = await page.request.delete(noteUrl(workout.id, exerciseId), {
      data: { expectedNoteId: created.id, expectedVersion: 1 },
    });
    expect(rejectedDelete.status()).toBe(400);
    expect(await rejectedDelete.json()).toMatchObject({ code: 'VALIDATION' });

    const frozen = await getContext(page, workout.id, exerciseId);
    expect(frozen.currentNote).toMatchObject({
      id: created.id,
      note: 'nota congelada',
      version: 1,
    });
  });

  test('cross-user isolation: B cannot read or mutate A and never sees A note', async () => {
    const userA = await playwrightRequest.newContext({ baseURL: BASE_URL });
    const userB = await playwrightRequest.newContext({ baseURL: BASE_URL });
    try {
      const registerA = await userA.post('/api/auth/register', {
        data: { name: 'Memory A', email: uniqueEmail('memory-a'), password: PASSWORD },
      });
      expect(registerA.status()).toBe(201);

      const routinesResponse = await userA.get('/api/routines');
      expect(routinesResponse.status()).toBe(200);
      const routines = (await routinesResponse.json()) as RoutineDto[];
      const routine = routines.find((candidate) => candidate.exercises.length >= 1);
      expect(routine).toBeTruthy();
      const routineId = (routine as RoutineDto).id;
      const exerciseId = (routine as RoutineDto).exercises[0].exerciseId;

      const workoutResponse = await userA.post('/api/workouts', { data: { routineId } });
      expect(workoutResponse.status()).toBe(201);
      const workout = (await workoutResponse.json()) as WorkoutDto;

      const noteResponse = await userA.put(noteUrl(workout.id, exerciseId), {
        data: { note: 'nota privada de A', expectedNoteId: null, expectedVersion: null },
      });
      expect(noteResponse.status()).toBe(201);
      const note = (await noteResponse.json()) as NoteDto;

      const registerB = await userB.post('/api/auth/register', {
        data: { name: 'Memory B', email: uniqueEmail('memory-b'), password: PASSWORD },
      });
      expect(registerB.status()).toBe(201);

      const foreignRead = await userB.get(contextUrl(workout.id, exerciseId));
      expect(foreignRead.status()).toBe(403);
      expect(await foreignRead.json()).toMatchObject({ code: 'FORBIDDEN' });

      const foreignPut = await userB.put(noteUrl(workout.id, exerciseId), {
        data: { note: 'intruso', expectedNoteId: note.id, expectedVersion: 1 },
      });
      expect(foreignPut.status()).toBe(403);
      expect(await foreignPut.json()).toMatchObject({ code: 'FORBIDDEN' });

      const foreignDelete = await userB.delete(noteUrl(workout.id, exerciseId), {
        data: { expectedNoteId: note.id, expectedVersion: 1 },
      });
      expect(foreignDelete.status()).toBe(403);
      expect(await foreignDelete.json()).toMatchObject({ code: 'FORBIDDEN' });

      // B's own context for the same exercise holds no A note and no history.
      const ownWorkoutResponse = await userB.post('/api/workouts', { data: { routineId } });
      expect(ownWorkoutResponse.status()).toBe(201);
      const ownWorkout = (await ownWorkoutResponse.json()) as WorkoutDto;

      const ownContextResponse = await userB.get(contextUrl(ownWorkout.id, exerciseId));
      expect(ownContextResponse.status()).toBe(200);
      const ownContext = (await ownContextResponse.json()) as ContextDto;
      expect(ownContext.currentNote).toBeNull();
      expect(ownContext.lastCompletedNote).toBeNull();
      expect(JSON.stringify(ownContext)).not.toContain('nota privada de A');
    } finally {
      await userA.dispose();
      await userB.dispose();
    }
  });

  test('skip and hold still work and a saved note is retained afterwards', async ({ page }) => {
    await registerFreshUser(page);
    const routine = await firstRoutineWith(page, 2);
    const firstExerciseId = routine.exercises[0].exerciseId;
    const secondExerciseId = routine.exercises[1].exerciseId;
    const workout = await startGuidedWorkout(page, routine.id);

    const firstNote = await page.request.put(noteUrl(workout.id, firstExerciseId), {
      data: { note: 'nota antes de saltar', expectedNoteId: null, expectedVersion: null },
    });
    expect(firstNote.status()).toBe(201);

    const skipResponse = await page.request.post(`/api/workouts/${workout.id}/skip`, {
      data: { exerciseId: firstExerciseId, clientMutationId: `skip-${Date.now()}` },
    });
    expect(skipResponse.status()).toBe(200);
    const skipBody = (await skipResponse.json()) as {
      queue: { skippedExerciseIds: number[]; pendingExerciseIds: number[] };
    };
    expect(skipBody.queue.skippedExerciseIds).toContain(firstExerciseId);

    const skippedContext = await getContext(page, workout.id, firstExerciseId);
    expect(skippedContext.currentNote).toMatchObject({
      note: 'nota antes de saltar',
      version: 1,
    });

    const secondNote = await page.request.put(noteUrl(workout.id, secondExerciseId), {
      data: { note: 'nota antes de posponer', expectedNoteId: null, expectedVersion: null },
    });
    expect(secondNote.status()).toBe(201);

    const holdResponse = await page.request.post(`/api/workouts/${workout.id}/hold`, {
      data: { exerciseId: secondExerciseId, clientMutationId: `hold-${Date.now()}` },
    });
    expect(holdResponse.status()).toBe(200);
    const holdBody = (await holdResponse.json()) as {
      queue: { heldExerciseIds: number[] };
    };
    expect(holdBody.queue.heldExerciseIds).toContain(secondExerciseId);

    const heldContext = await getContext(page, workout.id, secondExerciseId);
    expect(heldContext.currentNote).toMatchObject({
      note: 'nota antes de posponer',
      version: 1,
    });

    // Queue actions changed no sets.
    const setsResponse = await page.request.get(`/api/workouts/${workout.id}/sets`);
    expect(setsResponse.status()).toBe(200);
    expect((await setsResponse.json()) as unknown[]).toEqual([]);
  });

  test('close screen shows honest persistence-only feedback copy with no recovery promise', async ({
    page,
  }) => {
    await registerFreshUser(page);
    const routine = await firstRoutineWith(page, 1);
    const workout = await startGuidedWorkout(page, routine.id);
    await closeWorkout(page, workout.id);

    await page.goto(`/dashboard/session/${workout.id}`);
    await expect(page.getByTestId('session-close')).toBeVisible();
    await expect(
      page.getByText(
        'Guardamos este feedback como parte de esta sesión. No cambia tu plan ni recomienda cargas automáticamente.',
      ),
    ).toBeVisible();
    await expect(page.locator('body')).not.toContainText('calibrar la recuperación');
    await expect(page.locator('body')).not.toContainText('recuperación');
  });

  test('mobile 390px: note editor and Última vez panel work without horizontal overflow', async ({
    page,
  }) => {
    await registerFreshUser(page);
    const routine = await firstRoutineWith(page, 1);
    const exerciseId = routine.exercises[0].exerciseId;
    const workout = await startGuidedWorkout(page, routine.id);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/session/${workout.id}`);

    await openNotesPanel(page);
    await page.getByTestId('exercise-note-input').fill('nota mobile');
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith(noteUrl(workout.id, exerciseId)) &&
          response.request().method() === 'PUT' &&
          (response.status() === 201 || response.status() === 200),
      ),
      page.getByRole('button', { name: 'Guardar nota' }).click(),
    ]);
    await expect(page.getByTestId('note-status')).toHaveText('Nota guardada.');
    const saved = await getContext(page, workout.id, exerciseId);
    expect(saved.currentNote).toMatchObject({ note: 'nota mobile', version: 1 });

    await openLastTimePanel(page);
    await expect(page.getByTestId('last-time-panel')).toBeVisible();
    await expect(page.getByTestId('session-skip')).toBeVisible();
    await expect(page.getByTestId('session-hold')).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });

  test('Unicode: 280 code points accepted with astral input and 281 rejected by the server', async ({
    page,
  }) => {
    await registerFreshUser(page);
    const routine = await firstRoutineWith(page, 1);
    const exerciseId = routine.exercises[0].exerciseId;
    const workout = await startGuidedWorkout(page, routine.id);

    const astral280 = '\u{1F600}'.repeat(280);
    expect(astral280.length).toBe(560);
    expect(Array.from(astral280).length).toBe(280);

    const createdResponse = await page.request.put(noteUrl(workout.id, exerciseId), {
      data: { note: astral280, expectedNoteId: null, expectedVersion: null },
    });
    expect(createdResponse.status()).toBe(201);
    const created = (await createdResponse.json()) as NoteDto;
    expect(created.note).toBe(astral280);
    expect(Array.from(created.note).length).toBe(280);

    const bmp280 = 'b'.repeat(280);
    const updatedResponse = await page.request.put(noteUrl(workout.id, exerciseId), {
      data: { note: bmp280, expectedNoteId: created.id, expectedVersion: 1 },
    });
    expect(updatedResponse.status()).toBe(200);
    expect((await updatedResponse.json()) as NoteDto).toMatchObject({
      id: created.id,
      note: bmp280,
      version: 2,
    });

    const astral281 = '\u{1F600}'.repeat(281);
    const rejectedResponse = await page.request.put(noteUrl(workout.id, exerciseId), {
      data: { note: astral281, expectedNoteId: null, expectedVersion: null },
    });
    expect(rejectedResponse.status()).toBe(400);
    expect(await rejectedResponse.json()).toMatchObject({ code: 'VALIDATION' });

    const afterRejection = await getContext(page, workout.id, exerciseId);
    expect(afterRejection.currentNote).toMatchObject({
      id: created.id,
      note: bmp280,
      version: 2,
    });
  });
});
