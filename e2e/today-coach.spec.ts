import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Test1234!';

interface RoutineSummary {
  id: number;
  slug: string;
  name: string;
  exercises: Array<{
    exerciseId: number;
    exerciseName: string;
    targetSets: number;
  }>;
}

async function registerFreshUser(page: Page): Promise<void> {
  const user = {
    name: 'Today Coach E2E',
    email: `today-coach-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`,
    password: PASSWORD,
  };

  await page.goto('/register');
  await page.fill('input[type="text"]', user.name);
  await page.fill('input[type="email"]', user.email);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(user.password);
  await passwordInputs.nth(1).fill(user.password);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/register') && response.status() === 201,
    ),
    page.waitForURL('/dashboard/today', { timeout: 15000 }),
    page.getByRole('button', { name: 'Crear cuenta' }).click(),
  ]);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
}

test.describe('Today Coach adapted session', () => {
  test('previews without starting, then persists and resumes removed/reduced exercise state on mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await registerFreshUser(page);

    const routinesResponse = await page.request.get('/api/routines');
    expect(routinesResponse.status()).toBe(200);
    const routines = (await routinesResponse.json()) as RoutineSummary[];
    const routine = routines.find((item) => item.slug === 'empuje');
    if (!routine || routine.exercises.length !== 2) {
      throw new Error('The seeded Empuje routine with two exercises is required for this test.');
    }
    const removedExercise = routine.exercises[0];
    const reducedExercise = routine.exercises[1];
    if (!removedExercise || !reducedExercise || reducedExercise.targetSets < 2) {
      throw new Error('The seeded Empuje routine must support removed and reduced targets.');
    }

    const preview = {
      original: { exerciseCount: 2, setCount: 6, estMinutes: 35 },
      adapted: { exerciseCount: 1, setCount: 2, estMinutes: 15 },
      exerciseDeltas: [
        {
          exerciseId: removedExercise.exerciseId,
          name: removedExercise.exerciseName,
          action: 'removed',
          fromSets: removedExercise.targetSets,
          toSets: 0,
        },
        {
          exerciseId: reducedExercise.exerciseId,
          name: reducedExercise.exerciseName,
          action: 'reduced',
          fromSets: reducedExercise.targetSets,
          toSets: 2,
        },
      ],
      reason: 'Bajamos el volumen según lo que registraste hoy.',
      source: 'deterministic',
    } as const;

    await page.route('**/api/today', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'workout',
          localDate: '2026-09-25',
          dayOfWeek: 5,
          trainingPlanId: 1,
          scheduledRoutineId: 1,
          routineId: routine.id,
          routineName: routine.name,
          planGoal: 'Fuerza',
          dayReason: null,
          completion: { completed: 0, total: 0 },
        }),
      });
    });
    await page.route('**/api/coach/preview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(preview),
      });
    });

    const workoutPosts: import('@playwright/test').Request[] = [];
    const forbiddenMutations: string[] = [];
    page.on('request', (request) => {
      const { pathname } = new URL(request.url());
      if (pathname === '/api/workouts' && request.method() === 'POST') {
        workoutPosts.push(request);
      }
      if (
        (pathname.startsWith('/api/training-plan') || pathname.startsWith('/api/routines')) &&
        request.method() !== 'GET'
      ) {
        forbiddenMutations.push(`${request.method()} ${pathname}`);
      }
    });

    await page.goto('/dashboard/today');
    await expect(page.getByRole('heading', { name: 'Coach Atlas' })).toBeVisible();
    await expect(page.getByText(/datos biométricos/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    const activeBeforePreview = await page.request.get('/api/workouts/active');
    expect(activeBeforePreview.status()).toBe(200);
    expect(await activeBeforePreview.json()).toBeNull();

    await page.getByRole('button', { name: 'Tengo 30 min' }).click();
    await expect(page.getByRole('region', { name: 'Vista previa de adaptación de Coach Atlas' })).toBeVisible();
    await expect(
      page.getByText('Vista previa: tu rutina guardada no cambia hasta iniciar la sesión.'),
    ).toBeVisible();
    await expect(page.getByText('Aplicado', { exact: true })).toHaveCount(0);
    expect(workoutPosts).toHaveLength(0);
    const startButton = page.getByRole('button', { name: 'Empezar entrenamiento adaptado' });
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();
    const startButtonBox = await startButton.boundingBox();
    expect(startButtonBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/workouts' &&
          response.request().method() === 'POST' &&
          response.status() === 201,
      ),
      page.waitForURL(/\/dashboard\/session\/\d+$/, { timeout: 10000 }),
      startButton.click(),
    ]);
    const createdWorkout = (await createResponse.json()) as { id: number };
    expect(createResponse.request().postDataJSON()).toEqual({
      routineId: routine.id,
      adaptation: { result: preview, freeText: 'Tengo 30 minutos' },
    });
    expect(workoutPosts).toHaveLength(1);
    expect(forbiddenMutations).toEqual([]);

    await expect(page.getByTestId('guided-exercise-name')).toHaveText(
      reducedExercise.exerciseName,
    );
    await expect(page.getByTestId('set-pending')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);

    const persistedWorkoutResponse = await page.request.get(
      `/api/workouts/${createdWorkout.id}`,
    );
    expect(persistedWorkoutResponse.status()).toBe(200);
    const persistedWorkout = (await persistedWorkoutResponse.json()) as {
      queue: {
        skippedExerciseIds: number[];
        targetSetsOverrides: Record<number, number>;
      };
    };
    expect(persistedWorkout.queue).toMatchObject({
      skippedExerciseIds: [removedExercise.exerciseId],
      targetSetsOverrides: { [reducedExercise.exerciseId]: 2 },
    });

    await page.reload();
    await expect(page.getByTestId('guided-exercise-name')).toHaveText(
      reducedExercise.exerciseName,
    );
    await expect(page.getByTestId('set-pending')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });
});
