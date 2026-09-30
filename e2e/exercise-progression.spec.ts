import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { completeOnboardingForCurrentUser } from './helpers/auth';

/**
 * v0.12 truthful comparable progression E2E (Workstream F).
 *
 * Proves the guided-session surface loads the versioned read model for a valid
 * external cohort and refuses to manufacture one for a non-comparable mode.
 * Each scenario registers its own user so the shared file DB cannot collide.
 */

const PASSWORD = 'Test1234!';

interface RoutineExerciseDto {
  exerciseId: number;
  targetReps: number;
}

interface RoutineDto {
  id: number;
  exercises: RoutineExerciseDto[];
}

interface WorkoutDto {
  id: number;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`;
}

async function registerFreshUser(page: Page): Promise<void> {
  const email = uniqueEmail('exercise-progression-e2e');
  await page.goto('/register');
  await page.fill('input[type="text"]', 'Exercise Progression E2E');
  await page.fill('input[type="email"]', email);
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

async function firstRoutineWithExercise(page: Page): Promise<RoutineDto> {
  const response = await page.request.get('/api/routines');
  expect(response.status()).toBe(200);
  const routines = (await response.json()) as RoutineDto[];
  const routine = routines.find((candidate) => candidate.exercises.length >= 1);
  expect(routine, 'seeded routine with at least one exercise').toBeTruthy();
  return routine as RoutineDto;
}

async function createWorkout(page: Page, routineId?: number): Promise<WorkoutDto> {
  const response = await page.request.post('/api/workouts', {
    data: routineId === undefined ? {} : { routineId },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as WorkoutDto;
}

async function closeWorkout(page: Page, workoutId: number): Promise<void> {
  const response = await page.request.patch(`/api/workouts/${workoutId}`, {
    data: { endedAt: new Date().toISOString() },
  });
  expect(response.status()).toBe(200);
}

async function seedClosedExternalSet(
  page: Page,
  workoutId: number,
  exerciseId: number,
  reps: number,
): Promise<void> {
  const response = await page.request.post(`/api/workouts/${workoutId}/sets`, {
    data: {
      exerciseId,
      setIndex: 1,
      reps,
      weightKg: '50',
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

async function openGuidedWorkout(page: Page, workoutId: number): Promise<void> {
  await page.goto(`/dashboard/session/${workoutId}`);
  await expect(page.getByTestId('guided-exercise-card')).toBeVisible({ timeout: 15000 });
}

test.describe('Truthful comparable progression', () => {
  test('shows the comparable card for a valid external cohort with closed history', async ({
    page,
  }) => {
    await registerFreshUser(page);
    const routine = await firstRoutineWithExercise(page);
    const exercise = routine.exercises[0];

    const historyWorkout = await createWorkout(page, routine.id);
    await seedClosedExternalSet(page, historyWorkout.id, exercise.exerciseId, exercise.targetReps);
    await closeWorkout(page, historyWorkout.id);

    const currentWorkout = await createWorkout(page, routine.id);
    await openGuidedWorkout(page, currentWorkout.id);

    await page.getByTestId('semantics-loadMode-external').click();
    await page.getByTestId('semantics-amountBasis-total').click();
    await page.getByTestId('semantics-side-bilateral').click();
    await page.getByTestId('semantics-purpose-working').click();
    await page.fill('[data-testid="guided-reps-input"]', String(exercise.targetReps));

    await page.getByRole('button', { name: 'Mostrar progresión comparable' }).click();

    await expect(page.getByTestId('exercise-progression-panel')).toBeVisible();
    await expect(page.getByTestId('progression-ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('progression-conclusion')).toContainText('Punto de referencia');
    await expect(page.getByTestId('progression-ready')).toContainText(/50 kg/);
    await expect(page.getByText(/Solo historial de entrenamientos cerrados/)).toBeVisible();
    await expect(page.getByTestId('exercise-progression-panel')).not.toContainText(/más fuerte|1RM/i);
  });

  test('refuses to manufacture a comparable cohort for bodyweight', async ({ page }) => {
    await registerFreshUser(page);
    const routine = await firstRoutineWithExercise(page);
    const currentWorkout = await createWorkout(page, routine.id);

    await openGuidedWorkout(page, currentWorkout.id);
    await page.getByTestId('semantics-loadMode-bodyweight').click();
    await page.getByTestId('semantics-side-bilateral').click();
    await page.getByTestId('semantics-purpose-working').click();

    await page.getByRole('button', { name: 'Mostrar progresión comparable' }).click();

    await expect(page.getByTestId('progression-unsupported')).toBeVisible();
    await expect(page.getByTestId('progression-unsupported')).toContainText('solo aplica a carga externa');
  });
});
