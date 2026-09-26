import { expect, test, type Page, type Request } from '@playwright/test';
import { completeOnboardingForCurrentUser } from './helpers/auth';

const PASSWORD = 'Test1234!';
const ONBOARDING_ANSWERS_KEY = 'atlas:onboarding:answers';
const PREFERENCES_ENDPOINT = '/api/profile/preferences';
const EMPTY_PREFERENCES = { goal: null, pace: null, equipment: null };
const WEEKDAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

interface UserPreferencesResponse {
  hasSavedPreferences: boolean;
  preferences: {
    goal: string | null;
    pace: string | null;
    equipment: string | null;
  };
}

interface GeneratedDraft {
  source: 'fallback' | 'gemini';
  name: string;
  goal: string;
  days: Array<{
    dayOfWeek: number;
    title: string;
    focus: string;
    exercises: Array<{
      exerciseId: number;
      sortOrder: number;
      exerciseName: string;
      muscleGroup: string;
      targetSets: number;
      targetReps: number;
    }>;
  }>;
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

interface ScheduledRoutine {
  id: number;
  trainingPlanId: number;
  dayOfWeek: number;
  routineId: number;
}

interface SavedPlanResult {
  plan: {
    id: number;
    userId: number;
    goal: string | null;
    isActive: boolean;
    deletedAt: string | null;
  };
  schedule: ScheduledRoutine[];
}

interface TodaySnapshot {
  kind: 'no_plan' | 'rest_day' | 'workout' | 'routine_missing';
  trainingPlanId?: number;
  routineId?: number;
}

interface AuthUser {
  id: number;
}

interface TestUser {
  name: string;
  email: string;
  password: string;
}

function createTestUser(prefix: string): TestUser {
  return {
    name: `Coach Context ${prefix}`,
    email: `coach-context-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`,
    password: PASSWORD,
  };
}

async function registerFreshUser(page: Page, startOnboarding = false): Promise<void> {
  const user = createTestUser(startOnboarding ? 'onboarding' : 'import');
  await page.goto('/register');
  if (startOnboarding) {
    await page.evaluate((answersKey) => localStorage.removeItem(answersKey), ONBOARDING_ANSWERS_KEY);
  }

  await page.fill('input[type="text"]', user.name);
  await page.fill('input[type="email"]', user.email);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(user.password);
  await passwordInputs.nth(1).fill(user.password);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/register') &&
        response.status() === 201,
    ),
    ...(startOnboarding ? [page.waitForURL('/onboarding', { timeout: 15000 })] : []),
    page.getByRole('button', { name: 'Crear cuenta' }).click(),
  ]);
  if (!startOnboarding) {
    await completeOnboardingForCurrentUser(page);
  }
}

async function selectOnboardingOption(
  page: Page,
  heading: string,
  optionTitle: string,
): Promise<void> {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page
    .getByTestId('onboarding-option')
    .filter({ hasText: optionTitle })
    .click();
  await page.getByTestId('onboarding-continue').click();
}

async function advanceToLegacyImport(page: Page): Promise<void> {
  await selectOnboardingOption(
    page,
    '¿Cuál es tu prioridad principal hoy?',
    'Ganar músculo',
  );
  await selectOnboardingOption(
    page,
    '¿Con qué frecuencia vas a entrenar?',
    '2 días por semana',
  );
  await selectOnboardingOption(page, '¿Con qué equipo contás?', 'Mancuernas en casa');
  await expect(page.getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible();
}

async function getPreferences(page: Page): Promise<UserPreferencesResponse> {
  const response = await page.request.get(PREFERENCES_ENDPOINT);
  expect(response.status()).toBe(200);
  return (await response.json()) as UserPreferencesResponse;
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
  plan: SavedPlanResult,
): Promise<RoutineSummary[]> {
  const scheduledRoutineIds = [
    ...new Set(plan.schedule.map(({ routineId }) => routineId)),
  ].sort((left, right) => left - right);

  const planRoutines = await getRoutinesForPlan(page, plan.plan.id);
  const planRoutineIds = planRoutines.map(({ id }) => id);
  expect(new Set(planRoutineIds).size).toBe(planRoutineIds.length);
  expect(
    planRoutineIds
      .filter((routineId) => scheduledRoutineIds.includes(routineId))
      .sort((left, right) => left - right),
  ).toEqual(scheduledRoutineIds);
  return planRoutines;
}

async function getToday(page: Page): Promise<TodaySnapshot> {
  const response = await page.request.get('/api/today');
  expect(response.status()).toBe(200);
  return (await response.json()) as TodaySnapshot;
}

test.describe('Coach Context', () => {
  test.describe.configure({ mode: 'serial' });

  test('saves onboarding context, reviews a non-persistent draft, and persists only on explicit save', async ({
    page,
  }) => {
    await registerFreshUser(page, true);
    await expect(page.getByTestId('onboarding-wizard')).toBeVisible();

    const initiallySaved = await getPreferences(page);
    expect(initiallySaved).toEqual({
      hasSavedPreferences: false,
      preferences: EMPTY_PREFERENCES,
    });

    await selectOnboardingOption(
      page,
      '¿Cuál es tu prioridad principal hoy?',
      'Ganar fuerza',
    );
    await selectOnboardingOption(
      page,
      '¿Con qué frecuencia vas a entrenar?',
      '5 o más días',
    );
    await selectOnboardingOption(page, '¿Con qué equipo contás?', 'Gimnasio completo');
    await expect(page.getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible();

    const [onboardingSave] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/profile/onboarding') &&
          response.request().method() === 'POST',
      ),
      page.waitForURL('/dashboard/today', { timeout: 10000 }),
      page.getByTestId('onboarding-continue').click(),
    ]);
    expect(onboardingSave.status()).toBe(200);
    await expect(onboardingSave.json()).resolves.toEqual({ completed: true });

    const savedPreferences = await getPreferences(page);
    expect(savedPreferences).toEqual({
      hasSavedPreferences: true,
      preferences: { goal: 'strength', pace: 'days-5', equipment: 'gym' },
    });

    const meResponse = await page.request.get('/api/auth/me');
    expect(meResponse.status()).toBe(200);
    const currentUser = (await meResponse.json()) as AuthUser;

    await page.evaluate((answersKey) => {
      localStorage.setItem(
        answersKey,
        JSON.stringify({ goal: 'consistency', pace: 'days-2', equipment: 'bands' }),
      );
    }, ONBOARDING_ANSWERS_KEY);

    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Mi Atlas' })).toBeVisible();
    await expect(page.getByText('Guardadas en tu perfil')).toBeVisible();
    await expect(page.getByText('Ganar fuerza', { exact: true })).toBeVisible();
    await expect(page.getByText('5 o más días', { exact: true })).toBeVisible();
    await expect(page.getByText('Gimnasio completo', { exact: true })).toBeVisible();
    await expect(page.getByTestId('profile-review-legacy-import')).toHaveCount(0);

    await page.getByRole('button', { name: 'Editar preferencias' }).click();
    await expect(page.locator('#profile-preference-goal')).toHaveValue('strength');
    await expect(page.locator('#profile-preference-pace')).toHaveValue('days-5');
    await expect(page.locator('#profile-preference-equipment')).toHaveValue('gym');
    await page.getByTestId('profile-preferences-cancel').click();

    const todayBeforeGeneration = await getToday(page);
    expect(todayBeforeGeneration.kind).toBe('no_plan');
    const libraryBeforeGeneration = await getRoutines(page);
    expect(libraryBeforeGeneration.filter((routine) => !routine.isSystem)).toHaveLength(0);
    const libraryBaselineIds = libraryBeforeGeneration
      .map(({ id }) => id)
      .sort((left, right) => left - right);

    const guidedSaveRequests: Request[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.pathname === '/api/training-plan/guided' &&
        request.method() === 'POST'
      ) {
        guidedSaveRequests.push(request);
      }
    });

    await page.goto('/dashboard/plan/guided');
    const goalInput = page.locator('#guided-goal');
    const daysInput = page.locator('#guided-days');
    const equipmentInput = page.locator('#guided-equipment');
    await expect(goalInput).toHaveValue('Ganar fuerza');
    await expect(daysInput).toHaveValue('5');
    await expect(equipmentInput).toHaveValue('Gimnasio completo');

    await daysInput.fill('4');
    await expect(daysInput).toHaveValue('4');
    await daysInput.fill('5');
    await expect(daysInput).toHaveValue('5');

    const [generateResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/training-plan/generate') &&
          response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Generar plan semanal' }).click(),
    ]);
    expect(generateResponse.status()).toBe(200);
    const generateBrief = generateResponse.request().postDataJSON() as {
      goal: string;
      daysPerWeek: number;
      availableEquipment: string[];
    };
    expect(generateBrief).toMatchObject({
      goal: 'Ganar fuerza',
      daysPerWeek: 5,
      availableEquipment: ['Gimnasio completo'],
    });

    const draft = (await generateResponse.json()) as GeneratedDraft;
    if (process.env.CI) {
      expect(draft.source).toBe('fallback');
    }
    expect(draft.goal).toBe('Ganar fuerza');
    expect(draft.days).toHaveLength(5);
    if (draft.source === 'fallback') {
      expect(draft.days.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5]);
    } else {
      expect(new Set(draft.days.map((day) => day.dayOfWeek)).size).toBe(5);
    }
    await expect(page.getByRole('heading', { name: 'Revisá la semana propuesta' })).toBeVisible();
    if (draft.source === 'fallback') {
      await expect(page.getByText('Respaldo determinista de Atlas')).toBeVisible();
      await expect(page.getByText('Propuesta de Gemini', { exact: false })).toHaveCount(0);
    } else {
      await expect(
        page.getByText(
          'Propuesta de Gemini · catálogo y objetivos validados y normalizados por Atlas',
        ),
      ).toBeVisible();
      await expect(page.getByText('Respaldo determinista de Atlas')).toHaveCount(0);
    }
    await expect(page.getByText('Objetivo indicado: Ganar fuerza.')).toBeVisible();

    const dayCards = page.locator('article');
    await expect(dayCards).toHaveCount(draft.days.length);
    for (const [index, day] of draft.days.entries()) {
      const card = dayCards.nth(index);
      await expect(card.getByRole('heading', { name: day.title, exact: true })).toBeVisible();
      await expect(card).toContainText(day.focus);
      await expect(card).toContainText(WEEKDAY_LABELS[day.dayOfWeek] ?? 'Día desconocido');
      await expect(card.getByRole('listitem')).toHaveCount(day.exercises.length);
      for (const exercise of day.exercises) {
        await expect(card.getByText(exercise.exerciseName, { exact: true })).toBeVisible();
        await expect(
          card.getByText(
            `${exercise.muscleGroup} · ${exercise.targetSets}×${exercise.targetReps}`,
            { exact: true },
          ),
        ).toBeVisible();
      }
    }
    expect((await dayCards.allTextContents()).join('\n')).not.toMatch(
      /compatible|garantiza|duración estimada/i,
    );
    expect(guidedSaveRequests).toHaveLength(0);

    const todayAfterGeneration = await getToday(page);
    expect(todayAfterGeneration.kind).toBe('no_plan');
    const libraryAfterGeneration = await getRoutines(page);
    expect(
      libraryAfterGeneration.map(({ id }) => id).sort((left, right) => left - right),
    ).toEqual(libraryBaselineIds);

    const [guidedSaveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/training-plan/guided') &&
          response.request().method() === 'POST',
      ),
      page.waitForURL('/dashboard/today', { timeout: 10000 }),
      page.getByRole('button', { name: 'Guardar plan' }).click(),
    ]);
    expect(guidedSaveResponse.status()).toBe(200);
    expect(guidedSaveRequests).toHaveLength(1);
    const saveRequest = guidedSaveRequests[0];
    expect(saveRequest).toBeDefined();
    const savePayload = saveRequest?.postDataJSON() as {
      mutationId: string;
      goal: string;
      days: Array<{ dayOfWeek: number }>;
    };
    expect(savePayload.mutationId).toMatch(/^[\da-f-]{36}$/i);
    expect(savePayload.goal).toBe('Ganar fuerza');
    expect(savePayload.days.map((day) => day.dayOfWeek)).toEqual(
      draft.days.map((day) => day.dayOfWeek),
    );

    const savedPlan = (await guidedSaveResponse.json()) as SavedPlanResult;
    expect(savedPlan.plan).toMatchObject({
      userId: currentUser.id,
      goal: 'Ganar fuerza',
      isActive: true,
      deletedAt: null,
    });
    expect(savedPlan.schedule).toHaveLength(5);
    expect(
      savedPlan.schedule.map(({ dayOfWeek }) => dayOfWeek).sort((left, right) => left - right),
    ).toEqual(draft.days.map(({ dayOfWeek }) => dayOfWeek).sort((left, right) => left - right));
    const libraryAfterSave = await getRoutines(page);
    expect(libraryAfterSave.map(({ id }) => id).sort((left, right) => left - right)).toEqual(
      libraryBaselineIds,
    );
    const scheduledRoutineIds = savedPlan.schedule.map(({ routineId }) => routineId);
    expect(libraryAfterSave.some(({ id }) => scheduledRoutineIds.includes(id))).toBe(false);
    const routinesInSavedPlan = await expectPlanRoutinesVisible(page, savedPlan);
    for (const scheduled of savedPlan.schedule) {
      const detailResponse = await page.request.get(
        `/api/routines/${scheduled.routineId}?trainingPlanId=${savedPlan.plan.id}`,
      );
      expect(detailResponse.status()).toBe(200);
      expect((await detailResponse.json() as RoutineSummary).id).toBe(scheduled.routineId);
    }

    const saveRequestBody = saveRequest?.postData();
    if (saveRequestBody === null || saveRequestBody === undefined) {
      throw new Error('The guided save request did not include a body.');
    }
    const replayResponse = await page.request.post('/api/training-plan/guided', {
      data: saveRequestBody,
      headers: {
        'content-type': saveRequest.headers()['content-type'] ?? 'application/json',
      },
    });
    expect(replayResponse.status()).toBe(200);
    const replayedPlan = (await replayResponse.json()) as SavedPlanResult;
    expect(replayedPlan.plan.id).toBe(savedPlan.plan.id);
    expect(replayedPlan.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId])).toEqual(
      savedPlan.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId]),
    );
    const libraryAfterReplay = await getRoutines(page);
    expect(libraryAfterReplay.map(({ id }) => id).sort((left, right) => left - right)).toEqual(
      libraryBaselineIds,
    );
    expect(libraryAfterReplay.some(({ id }) => scheduledRoutineIds.includes(id))).toBe(false);
    const routinesAfterReplay = await expectPlanRoutinesVisible(page, replayedPlan);
    expect(routinesAfterReplay.map(({ id }) => id).sort((left, right) => left - right)).toEqual(
      routinesInSavedPlan.map(({ id }) => id).sort((left, right) => left - right),
    );

    await page.reload();
    const todayAfterReload = await getToday(page);
    expect(todayAfterReload.kind).not.toBe('no_plan');
    expect(todayAfterReload.kind).not.toBe('routine_missing');
    expect(todayAfterReload.trainingPlanId).toBe(savedPlan.plan.id);
    if (todayAfterReload.kind === 'workout') {
      expect(savedPlan.schedule.some((item) => item.routineId === todayAfterReload.routineId)).toBe(
        true,
      );
    }

    const persistedPlanResponse = await page.request.get(
      `/api/training-plan/${savedPlan.plan.id}`,
    );
    expect(persistedPlanResponse.status()).toBe(200);
    const persistedPlan = (await persistedPlanResponse.json()) as SavedPlanResult;
    expect(persistedPlan.plan).toMatchObject({
      id: savedPlan.plan.id,
      userId: currentUser.id,
      isActive: true,
      deletedAt: null,
    });
    expect(persistedPlan.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId])).toEqual(
      savedPlan.schedule.map(({ dayOfWeek, routineId }) => [dayOfWeek, routineId]),
    );

    const persistedRoutines = await expectPlanRoutinesVisible(page, persistedPlan);
    for (const scheduled of persistedPlan.schedule) {
      const routine = persistedRoutines.find((item) => item.id === scheduled.routineId);
      expect(routine).toBeDefined();
      expect(routine?.isSystem).toBe(false);
      const draftDay = draft.days.find((day) => day.dayOfWeek === scheduled.dayOfWeek);
      expect(draftDay).toBeDefined();
      expect(
        routine?.exercises.map(({ exerciseId, sortOrder, targetSets, targetReps }) => ({
          exerciseId,
          sortOrder,
          targetSets,
          targetReps,
        })),
      ).toEqual(
        draftDay?.exercises.map(({ exerciseId, sortOrder, targetSets, targetReps }) => ({
          exerciseId,
          sortOrder,
          targetSets,
          targetReps,
        })),
      );
    }

    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Mi Atlas' })).toBeVisible();
    const activePlanLink = page.getByTestId('training-plan-settings');
    await expect(activePlanLink).toHaveAttribute(
      'href',
      `/dashboard/plan/${savedPlan.plan.id}`,
    );
    await activePlanLink.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/plan/${savedPlan.plan.id}$`));
    await expect(page.getByText('Plan activo', { exact: true })).toBeVisible();
    const weekGrid = page.getByTestId('plan-hub-week-grid');
    await expect(weekGrid).toBeVisible();
    await expect(weekGrid.getByRole('listitem')).toHaveCount(7);
    await expect(weekGrid.getByRole('heading', { level: 3 })).toHaveText([
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ]);
  });

  test('imports legacy browser answers only after preview and explicit confirmation when no row exists', async ({
    page,
  }) => {
    await registerFreshUser(page);
    await page.evaluate((answersKey) => {
      localStorage.setItem(
        answersKey,
        JSON.stringify({ goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' }),
      );
    }, ONBOARDING_ANSWERS_KEY);

    const initiallySaved = await getPreferences(page);
    expect(initiallySaved).toEqual({
      hasSavedPreferences: false,
      preferences: EMPTY_PREFERENCES,
    });

    const preferenceWrites: Request[] = [];
    page.on('request', (request) => {
      if (
        new URL(request.url()).pathname === PREFERENCES_ENDPOINT &&
        request.method() === 'PUT'
      ) {
        preferenceWrites.push(request);
      }
    });

    await page.goto('/dashboard/settings');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('heading', { name: 'Mi Atlas' })).toBeVisible();
    const definePreferences = page.getByRole('button', { name: 'Definir preferencias' });
    await expect(definePreferences).toHaveCSS('min-height', '44px');
    await definePreferences.click();
    await expect(page.getByTestId('profile-preferences-save')).toHaveCSS('min-height', '44px');
    await expect(page.getByTestId('profile-preferences-cancel')).toHaveCSS('min-height', '44px');
    await page.getByTestId('profile-preferences-cancel').click();
    await expect(page.getByTestId('profile-review-legacy-import')).toHaveCSS('min-height', '44px');
    await expect(page.getByTestId('generate-link-code')).toHaveCSS('min-height', '44px');
    await page.getByTestId('profile-review-legacy-import').click();
    await expect(page.getByText('Respuestas anteriores de este navegador')).toBeVisible();
    await expect(page.getByText('Ganar músculo', { exact: true })).toBeVisible();
    await expect(page.getByTestId('profile-confirm-legacy-import')).toHaveCSS(
      'min-height',
      '44px',
    );
    await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toHaveCSS(
      'min-height',
      '44px',
    );
    expect(preferenceWrites).toHaveLength(0);

    const [importResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith(PREFERENCES_ENDPOINT) &&
          response.request().method() === 'PUT',
      ),
      page.getByTestId('profile-confirm-legacy-import').click(),
    ]);
    expect(importResponse.status()).toBe(200);
    expect(importResponse.request().headers()['if-none-match']).toBe('*');
    expect(importResponse.request().postDataJSON()).toEqual({
      goal: 'muscle',
      pace: 'days-3',
      equipment: 'dumbbells',
    });
    expect(preferenceWrites).toHaveLength(1);
    expect(await getPreferences(page)).toEqual({
      hasSavedPreferences: true,
      preferences: { goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' },
    });
  });

  test('does not replace an existing all-null preference row with stale browser answers', async ({
    page,
  }) => {
    await registerFreshUser(page);
    const saveEmptyRow = await page.request.put(PREFERENCES_ENDPOINT, {
      data: EMPTY_PREFERENCES,
    });
    expect(saveEmptyRow.status()).toBe(200);
    expect(await saveEmptyRow.json()).toEqual({
      hasSavedPreferences: true,
      preferences: EMPTY_PREFERENCES,
    });

    await page.evaluate((answersKey) => {
      localStorage.setItem(
        answersKey,
        JSON.stringify({ goal: 'consistency', pace: 'days-2', equipment: 'bands' }),
      );
    }, ONBOARDING_ANSWERS_KEY);

    const preferenceWrites: Request[] = [];
    page.on('request', (request) => {
      if (
        new URL(request.url()).pathname === PREFERENCES_ENDPOINT &&
        request.method() === 'PUT'
      ) {
        preferenceWrites.push(request);
      }
    });

    await page.goto('/onboarding');
    await advanceToLegacyImport(page);
    await page.getByTestId('onboarding-import-legacy').click();
    await expect(page.getByText('Respuestas anteriores de este navegador')).toBeVisible();
    await page.getByTestId('onboarding-confirm-legacy-import').click();
    await expect(page.getByRole('status')).toContainText(
      'Ya hay preferencias guardadas en tu cuenta.',
    );

    expect(preferenceWrites).toHaveLength(0);
    expect(await getPreferences(page)).toEqual({
      hasSavedPreferences: true,
      preferences: EMPTY_PREFERENCES,
    });
  });
});
