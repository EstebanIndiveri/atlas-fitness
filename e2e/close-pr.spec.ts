import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { completeOnboardingForCurrentUser } from './helpers/auth';

/**
 * v0.13 verified close-time PR feedback (Workstream E).
 *
 * Seeds an exact closed-history baseline through the API, then closes a real
 * guided session through the UI with a heavier external set so the v0.12 read
 * model verifies a `new_pr` for the same cohort. Proves the celebration appears
 * only after the real local close and that navigation is explicit.
 */

const PASSWORD = 'Test1234!';

interface RoutineExerciseDto {
  exerciseId: number;
  targetReps: number;
}

interface RoutineDto {
  id: number;
  slug: string;
  exercises: RoutineExerciseDto[];
}

interface WorkoutDto {
  id: number;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`;
}

async function registerFreshUser(page: Page): Promise<void> {
  await page.goto('/register');
  await page.fill('input[type="text"]', 'Close PR E2E');
  await page.fill('input[type="email"]', uniqueEmail('close-pr-e2e'));
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(PASSWORD);
  await passwordInputs.nth(1).fill(PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/api/auth/register') && response.status() === 201,
    ),
    page.locator('button[type="submit"]').click(),
  ]);
  await completeOnboardingForCurrentUser(page);
}

async function fullBodyRoutine(page: Page): Promise<RoutineDto> {
  const response = await page.request.get('/api/routines');
  expect(response.status()).toBe(200);
  const routines = (await response.json()) as RoutineDto[];
  const routine = routines.find((candidate) => candidate.slug === 'full-body-expres');
  expect(routine, 'seeded full-body-expres routine').toBeTruthy();
  return routine as RoutineDto;
}

async function createWorkout(page: Page, routineId: number): Promise<WorkoutDto> {
  const response = await page.request.post('/api/workouts', { data: { routineId } });
  expect(response.status()).toBe(201);
  return (await response.json()) as WorkoutDto;
}

async function seedClosedExternalSet(
  page: Page,
  workoutId: number,
  exerciseId: number,
  reps: number,
  weightKg: string,
): Promise<void> {
  const response = await page.request.post(`/api/workouts/${workoutId}/sets`, {
    data: {
      exerciseId,
      setIndex: 1,
      reps,
      weightKg,
      semanticCaptureVersion: 1,
      loadMode: 'external',
      amountBasis: 'total',
      side: 'bilateral',
      setPurpose: 'working',
      repCountBasis: null,
    },
  });
  expect(response.status()).toBe(201);
}

async function closeWorkout(page: Page, workoutId: number): Promise<void> {
  const response = await page.request.patch(`/api/workouts/${workoutId}`, {
    data: { endedAt: new Date().toISOString() },
  });
  expect(response.status()).toBe(200);
}

async function selectExternalCohort(page: Page): Promise<void> {
  await page.getByTestId('semantics-loadMode-external').click();
  await page.getByTestId('semantics-amountBasis-total').click();
  await page.getByTestId('semantics-side-bilateral').click();
  await page.getByTestId('semantics-purpose-working').click();
}

test.describe('Verified close-time PR celebration', () => {
  test('celebrates a verified PR only after the real close, then continues explicitly', async ({
    page,
  }) => {
    await registerFreshUser(page);
    const routine = await fullBodyRoutine(page);
    const [first, second] = routine.exercises;
    expect(first, 'routine has a first exercise').toBeTruthy();
    expect(second, 'routine has a second exercise').toBeTruthy();

    // Exact-cohort baseline: a closed workout at a lighter external load.
    const history = await createWorkout(page, routine.id);
    await seedClosedExternalSet(page, history.id, first.exerciseId, first.targetReps, '40');
    await closeWorkout(page, history.id);

    // A fresh open workout closed through the real UI flow.
    const current = await createWorkout(page, routine.id);
    await page.goto(`/dashboard/session/${current.id}`);
    await expect(page.getByTestId('guided-exercise-name')).toHaveText('Press Banca', {
      timeout: 15000,
    });

    await selectExternalCohort(page);
    await page.fill('[data-testid="guided-weight-input"]', '50');
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201),
      page.getByTestId('complete-set-button').click(),
    ]);

    await expect(page.getByTestId('rest-timer')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('skip-rest').click();
    await expect(page.getByTestId('guided-exercise-name')).toHaveText('Sentadilla');
    await selectExternalCohort(page);
    await page.fill('[data-testid="guided-weight-input"]', '30');
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201),
      page.getByTestId('complete-set-button').click(),
    ]);

    await expect(page.getByTestId('session-close')).toBeVisible({ timeout: 5000 });
    // Pre-close language: routine done, not yet persisted.
    await expect(page.getByTestId('session-close')).toContainText('¡Rutina completada!');

    await page.getByTestId('close-effort-exigente').click();
    await page.getByTestId('close-mood-good').click();
    await page.getByTestId('close-save').click();

    const celebration = page.getByTestId('verified-pr-celebration');
    await expect(celebration).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('verified-pr-title')).toContainText(
      'Récord verificado para estas condiciones',
    );
    await expect(page.getByTestId('verified-pr-cohort')).toContainText(
      `${first.targetReps} reps`,
    );
    // Navigation is explicit; the celebration is not lost behind an instant push.
    await expect(page).not.toHaveURL('/dashboard/today');

    await Promise.all([
      page.waitForURL('/dashboard/today', { timeout: 10000 }),
      page.getByTestId('verified-pr-continue').click(),
    ]);
  });
});
