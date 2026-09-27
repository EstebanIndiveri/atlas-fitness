import { expect, test, type Page } from '@playwright/test';
import { completeOnboardingForCurrentUser } from './helpers/auth';

const PASSWORD = 'Test1234!';
const INTENT = 'Reducir volumen y mantener dos días de fuerza';

interface ExerciseSummary {
  id: number;
}

interface RoutineSummary {
  id: number;
  isSystem: boolean;
  exercises: Array<{
    exerciseId: number;
    sortOrder: number;
    targetSets: number;
    targetReps: number;
  }>;
}

interface PlanScheduleEntry {
  dayOfWeek: number;
  routineId: number;
}

interface TrainingPlanResult {
  plan: {
    id: number;
    userId: number;
    name: string;
    goal: string | null;
    isActive: boolean;
  };
  schedule: PlanScheduleEntry[];
}

interface ImprovementProposal {
  intent: string;
  currentPlan: {
    plan: { id: number; isActive: boolean; updatedAt: string };
    days: Array<{ dayOfWeek: number; assignment: { kind: string } }>;
  };
  proposal: {
    source: 'fallback' | 'gemini';
    name: string;
    goal: string;
    days: Array<{ dayOfWeek: number }>;
  };
}

async function registerFreshUser(page: Page): Promise<void> {
  const email = `plan-improvement-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`;
  await page.goto('/register');
  await page.fill('input[type="text"]', 'Plan Improvement E2E');
  await page.fill('input[type="email"]', email);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(PASSWORD);
  await passwordInputs.nth(1).fill(PASSWORD);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/register') && response.status() === 201,
    ),
    page.getByRole('button', { name: 'Crear cuenta' }).click(),
  ]);
  await completeOnboardingForCurrentUser(page);
}

async function getRoutines(page: Page): Promise<RoutineSummary[]> {
  return getRoutinesForPlan(page);
}

async function getRoutinesForPlan(
  page: Page,
  trainingPlanId?: number,
): Promise<RoutineSummary[]> {
  const planContext =
    trainingPlanId === undefined ? '' : `?trainingPlanId=${trainingPlanId}`;
  const response = await page.request.get(`/api/routines${planContext}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as RoutineSummary[];
}

async function expectPlanRoutinesVisible(
  page: Page,
  plan: TrainingPlanResult,
  libraryBaselineIds: number[],
): Promise<RoutineSummary[]> {
  const scheduledRoutineIds = [
    ...new Set(plan.schedule.map(({ routineId }) => routineId)),
  ].sort((left, right) => left - right);
  const expectedPlanContextIds = [
    ...new Set([...libraryBaselineIds, ...scheduledRoutineIds]),
  ].sort((left, right) => left - right);

  const planRoutines = await getRoutinesForPlan(page, plan.plan.id);
  const planRoutineIds = planRoutines.map(({ id }) => id);
  expect(new Set(planRoutineIds).size).toBe(planRoutineIds.length);
  expect(planRoutineIds.sort((left, right) => left - right)).toEqual(expectedPlanContextIds);
  return planRoutines;
}

test('improves only the selected active weekly plan after review and explicit confirmation', async ({
  page,
}) => {
  await registerFreshUser(page);

  const catalogResponse = await page.request.get('/api/exercises');
  expect(catalogResponse.status()).toBe(200);
  const catalog = (await catalogResponse.json()) as ExerciseSummary[];
  const exercise = catalog[0];
  if (!exercise) {
    throw new Error('The test exercise catalog is empty.');
  }

  const routineResponse = await page.request.post('/api/routines', {
    data: {
      name: `Rutina base ${Date.now()}`,
      description: 'Rutina original de la semana',
      kind: 'gym',
      restSeconds: 90,
      exercises: [{ exerciseId: exercise.id, sortOrder: 0, targetSets: 4, targetReps: 6 }],
    },
  });
  expect(routineResponse.status()).toBe(201);
  const originalRoutine = (await routineResponse.json()) as RoutineSummary;
  const libraryBaseline = await getRoutines(page);
  const libraryBaselineIds = libraryBaseline
    .map(({ id }) => id)
    .sort((left, right) => left - right);
  expect(libraryBaselineIds).toContain(originalRoutine.id);

  const planResponse = await page.request.post('/api/training-plan', {
    data: {
      name: 'Semana base',
      goal: 'Fuerza',
      schedule: [
        { dayOfWeek: 2, routineId: originalRoutine.id, note: 'Técnica' },
        { dayOfWeek: 6, routineId: originalRoutine.id, note: 'Volumen' },
      ],
    },
  });
  expect(planResponse.status()).toBe(200);
  const originalPlan = (await planResponse.json()) as TrainingPlanResult;
  expect(originalPlan.plan.isActive).toBe(true);
  const originalPlanId = originalPlan.plan.id;

  await page.goto(`/dashboard/plan/${originalPlanId}`);
  await expect(page.getByRole('heading', { name: 'Semana base' })).toBeVisible();
  await page.getByRole('link', { name: 'Mejorar plan con Coach Atlas' }).click();
  await expect(page.getByRole('heading', { name: /Mejorar Semana base/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Qué querés mejorar' }).fill(INTENT);

  const [firstProposalResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/training-plan/${originalPlanId}/improve`) &&
        response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Generar propuesta' }).click(),
  ]);
  expect(firstProposalResponse.status()).toBe(200);
  const firstProposal = (await firstProposalResponse.json()) as ImprovementProposal;
  expect(firstProposal.intent).toBe(INTENT);
  expect(firstProposal.currentPlan.plan).toMatchObject({
    id: originalPlanId,
    isActive: true,
  });
  expect(firstProposal.currentPlan.days.filter((day) => day.assignment.kind === 'routine'))
    .toHaveLength(2);
  await expect(page.getByRole('heading', { name: 'ANTES' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PROPUESTA' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar y reemplazar plan' })).toBeDisabled();

  const planBeforeConfirmationResponse = await page.request.get(
    `/api/training-plan/${originalPlanId}`,
  );
  const planBeforeConfirmation = (await planBeforeConfirmationResponse.json()) as TrainingPlanResult;
  expect(planBeforeConfirmation.plan.isActive).toBe(true);
  expect(planBeforeConfirmation.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId]))
    .toEqual(originalPlan.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId]));
  expect(
    (await getRoutines(page)).map(({ id }) => id).sort((left, right) => left - right),
  ).toEqual(
    libraryBaselineIds,
  );

  await page.getByRole('button', { name: 'Cancelar propuesta' }).click();
  await expect(page.getByRole('button', { name: 'Generar propuesta' })).toBeVisible();
  expect((await page.request.get(`/api/training-plan/${originalPlanId}`)).status()).toBe(200);
  expect(
    (await getRoutines(page)).map(({ id }) => id).sort((left, right) => left - right),
  ).toEqual(
    libraryBaselineIds,
  );

  const [proposalResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/training-plan/${originalPlanId}/improve`) &&
        response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Generar propuesta' }).click(),
  ]);
  expect(proposalResponse.status()).toBe(200);
  const acceptedProposal = (await proposalResponse.json()) as ImprovementProposal;
  const confirmationRequestWaiter = page.waitForRequest(
    (request) =>
      request.url().endsWith(`/api/training-plan/${originalPlanId}/improve/confirm`) &&
      request.method() === 'POST',
  );
  await page.getByRole('checkbox', { name: /confirmo reemplazar/i }).check();
  const [confirmationResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/training-plan/${originalPlanId}/improve/confirm`) &&
        response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Guardar y reemplazar plan' }).click(),
  ]);
  const confirmationRequest = await confirmationRequestWaiter;
  expect(confirmationResponse.status()).toBe(200);
  const savedPlan = (await confirmationResponse.json()) as TrainingPlanResult;
  expect(savedPlan.plan).toMatchObject({ isActive: true, goal: INTENT });
  expect(savedPlan.plan.id).not.toBe(originalPlanId);
  await page.waitForURL(`/dashboard/plan/${savedPlan.plan.id}`);

  const retiredPlanResponse = await page.request.get(`/api/training-plan/${originalPlanId}`);
  const retiredPlan = (await retiredPlanResponse.json()) as TrainingPlanResult;
  expect(retiredPlan.plan.isActive).toBe(false);
  expect(retiredPlan.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId]))
    .toEqual(originalPlan.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId]));
  expect(
    (await getRoutines(page)).find((routine) => routine.id === originalRoutine.id),
  ).toEqual(originalRoutine);
  const routinesInRetiredPlan = await expectPlanRoutinesVisible(
    page,
    retiredPlan,
    libraryBaselineIds,
  );
  expect(routinesInRetiredPlan.map(({ id }) => id)).toContain(originalRoutine.id);

  const libraryAfterImprovement = await getRoutines(page);
  expect(libraryAfterImprovement.map(({ id }) => id).sort((left, right) => left - right)).toEqual(
    libraryBaselineIds,
  );
  const generatedRoutineIds = savedPlan.schedule.map(({ routineId }) => routineId);
  expect(libraryAfterImprovement.some(({ id }) => generatedRoutineIds.includes(id))).toBe(false);
  const routinesInNewPlan = await expectPlanRoutinesVisible(
    page,
    savedPlan,
    libraryBaselineIds,
  );
  const routinesInRetiredPlanIds = routinesInRetiredPlan.map(({ id }) => id);
  expect(
    generatedRoutineIds.some((routineId) => routinesInRetiredPlanIds.includes(routineId)),
  ).toBe(false);
  for (const routineId of generatedRoutineIds) {
    const detailResponse = await page.request.get(
      `/api/routines/${routineId}?trainingPlanId=${savedPlan.plan.id}`,
    );
    expect(detailResponse.status()).toBe(200);
    expect((await detailResponse.json() as RoutineSummary).id).toBe(routineId);
  }

  const confirmPayload = confirmationRequest.postDataJSON() as {
    mutationId: string;
    expectedPlanUpdatedAt: string;
  };
  const confirmationBody = confirmationRequest.postData();
  if (!confirmationBody) {
    throw new Error('The confirmation request did not contain a JSON body.');
  }
  expect(confirmPayload.mutationId).toMatch(/^[\da-f-]{36}$/i);
  expect(confirmPayload.expectedPlanUpdatedAt).toBe(acceptedProposal.currentPlan.plan.updatedAt);
  const replayResponse = await page.request.post(
    `/api/training-plan/${originalPlanId}/improve/confirm`,
    { data: confirmationBody },
  );
  expect(replayResponse.status()).toBe(200);
  const replayedPlan = (await replayResponse.json()) as TrainingPlanResult;
  expect(replayedPlan.plan.id).toBe(savedPlan.plan.id);
  expect(replayedPlan.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId])).toEqual(
    savedPlan.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId]),
  );
  const libraryAfterReplay = await getRoutines(page);
  expect(libraryAfterReplay.map(({ id }) => id).sort((left, right) => left - right)).toEqual(
    libraryBaselineIds,
  );
  expect(libraryAfterReplay.some(({ id }) => generatedRoutineIds.includes(id))).toBe(false);
  expect(libraryAfterReplay.map(({ id }) => id)).toContain(originalRoutine.id);
  const routinesAfterReplay = await expectPlanRoutinesVisible(
    page,
    replayedPlan,
    libraryBaselineIds,
  );
  expect(routinesAfterReplay.map(({ id }) => id).sort((left, right) => left - right)).toEqual(
    routinesInNewPlan.map(({ id }) => id).sort((left, right) => left - right),
  );
});
