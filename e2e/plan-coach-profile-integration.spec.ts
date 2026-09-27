import { expect, test, type BrowserContext, type Dialog, type Page } from '@playwright/test';

const PASSWORD = 'Test1234!';

const BRIEF_GOAL = 'ganar fuerza sin dejar de moverme bien';
const BRIEF_DAYS = 3;
const BRIEF_EXPERIENCE = 'intermediate';
const BRIEF_EQUIPMENT_INITIAL = 'gimnasio completo';
const BRIEF_EQUIPMENT_PREFILLED = 'Gimnasio completo';
const BRIEF_LENGTH_MINUTES = '55';
const BRIEF_FOCUS = 'Pecho, Espalda';

const PROFILE_BRIEF_GOAL = 'resistencia para el día a día';
const PROFILE_BRIEF_FOCUS = 'Piernas, Glúteos';
const PROFILE_BRIEF_EQUIPMENT = 'Mancuernas en casa';

const COACH_PLAN_NAME_PREFIX = 'Coach Atlas · ';
const GUIDED_ROUTINE_PREFIX = 'Coach Atlas · Día ';
const TRAINING_PLAN_REPLACEMENT_CONFIRMATION =
  'Al confirmar, el plan activo se archivará y esta nueva versión quedará activa. Se conservarán el plan anterior, su agenda y sus rutinas.';

type OnboardingGoal = 'muscle' | 'strength' | 'fitness' | 'consistency' | 'wellbeing';
type OnboardingPace = 'days-2' | 'days-3' | 'days-4' | 'days-5';
type OnboardingEquipment = 'gym' | 'dumbbells' | 'bodyweight' | 'bands';

interface OnboardingAnswers {
  goal: OnboardingGoal;
  pace: OnboardingPace;
  equipment: OnboardingEquipment;
}

/** Spanish option titles rendered by the onboarding wizard, keyed by the persisted option id. */
const ONBOARDING_OPTION_TITLES: {
  goal: Record<OnboardingGoal, string>;
  pace: Record<OnboardingPace, string>;
  equipment: Record<OnboardingEquipment, string>;
} = {
  goal: {
    muscle: 'Ganar músculo',
    strength: 'Ganar fuerza',
    fitness: 'Mejorar condición física',
    consistency: 'Crear constancia',
    wellbeing: 'Sentirme mejor en el día a día',
  },
  pace: {
    'days-2': '2 días por semana',
    'days-3': '3 días por semana',
    'days-4': '4 días por semana',
    'days-5': '5 o más días',
  },
  equipment: {
    gym: 'Gimnasio completo',
    dumbbells: 'Mancuernas en casa',
    bodyweight: 'Peso corporal',
    bands: 'Bandas elásticas',
  },
};

interface PreferencesResponse {
  hasSavedPreferences: boolean;
  preferences: {
    goal: OnboardingGoal | null;
    pace: OnboardingPace | null;
    equipment: OnboardingEquipment | null;
  };
}

interface GuidedPlanExercise {
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  sortOrder: number;
  targetSets: number;
  targetReps: number;
}

interface GuidedPlanDay {
  dayOfWeek: number;
  title: string;
  focus: string;
  exercises: GuidedPlanExercise[];
}

interface WeeklyPlanDraft {
  source: 'fallback' | 'gemini';
  name: string;
  goal: string;
  days: GuidedPlanDay[];
}

interface ScheduledRoutine {
  dayOfWeek: number;
  routineId: number | null;
  note: string | null;
}

interface RoutineSummaryShape {
  id: number;
  name: string;
  isSystem: boolean;
}

interface TrainingPlanShape {
  id: number;
  name: string;
  goal: string | null;
  isActive: boolean;
  updatedAt: string;
}

interface SavedPlanResult {
  plan: TrainingPlanShape;
  schedule: ScheduledRoutine[];
  replacementStateHash: string;
}

interface TodaySnapshot {
  kind: 'no_plan' | 'rest_day' | 'workout' | 'routine_missing';
  localDate: string;
  dayOfWeek: number;
  trainingPlanId?: number;
  routineId?: number;
  routineName?: string;
  planGoal?: string | null;
}

interface TestUser {
  name: string;
  email: string;
  password: string;
}

function createTestUser(prefix: string): TestUser {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return {
    name: `${prefix} ${stamp}`,
    email: `e2e-${prefix}-${stamp}@test.com`,
    password: PASSWORD,
  };
}

async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.locator('input[type="text"]').fill(user.name);
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').nth(0).fill(user.password);
  await page.locator('input[type="password"]').nth(1).fill(user.password);
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith('/api/auth/register') && candidate.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Crear cuenta' }).click(),
  ]);
  expect(response.status()).toBe(201);
}

async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await Promise.all([
    page.waitForURL('/dashboard/today', { timeout: 30_000 }),
    page.getByRole('button', { name: 'Ingresar' }).click(),
  ]);
  await expect(page.getByTestId('welcome-message')).toHaveText(`Hola, ${user.name}`);
}

async function logoutUser(page: Page): Promise<void> {
  await Promise.all([
    page.waitForURL('/login', { timeout: 30_000 }),
    page.getByRole('button', { name: 'Cerrar sesión' }).click(),
  ]);
}

async function selectOnboardingOption(
  page: Page,
  heading: string,
  optionTitle: string,
): Promise<void> {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page.getByTestId('onboarding-option').filter({ hasText: optionTitle }).click();
  await page.getByTestId('onboarding-continue').click();
}

async function submitOnboarding(page: Page): Promise<void> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith('/api/profile/onboarding') &&
        candidate.request().method() === 'POST',
    ),
    page.getByTestId('onboarding-continue').click(),
  ]);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ completed: true });
  await page.waitForURL('/dashboard/today', { timeout: 30_000 });
  await expect(page.getByTestId('welcome-message')).toBeVisible();
}

async function completeOnboarding(page: Page, answers: OnboardingAnswers): Promise<void> {
  await selectOnboardingOption(
    page,
    '¿Cuál es tu prioridad principal hoy?',
    ONBOARDING_OPTION_TITLES.goal[answers.goal],
  );
  await selectOnboardingOption(
    page,
    '¿Con qué frecuencia vas a entrenar?',
    ONBOARDING_OPTION_TITLES.pace[answers.pace],
  );
  await selectOnboardingOption(
    page,
    '¿Con qué equipo contás?',
    ONBOARDING_OPTION_TITLES.equipment[answers.equipment],
  );

  await expect(page.getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible();
  await submitOnboarding(page);

  expect(await getPreferences(page)).toEqual({
    hasSavedPreferences: true,
    preferences: { ...answers },
  });
}

async function skipOnboarding(page: Page): Promise<void> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith('/api/profile/onboarding') &&
        candidate.request().method() === 'POST',
    ),
    page.getByTestId('onboarding-skip').click(),
  ]);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ completed: true });
  await page.waitForURL('/dashboard/today', { timeout: 30_000 });
  await expect(page.getByTestId('welcome-message')).toBeVisible();
}

async function getPreferences(page: Page): Promise<PreferencesResponse> {
  const response = await page.request.get('/api/profile/preferences');
  expect(response.ok()).toBe(true);
  return (await response.json()) as PreferencesResponse;
}

async function getActivePlan(page: Page): Promise<SavedPlanResult | null> {
  const response = await page.request.get('/api/training-plan/active');
  expect([200, 204]).toContain(response.status());
  if (response.status() === 204) {
    return null;
  }
  return (await response.json()) as SavedPlanResult;
}

/** Resolves the routine names a plan owns; the plan and schedule payloads only carry routine ids. */
async function getPlanRoutineNames(page: Page, planId: number): Promise<Map<number, string>> {
  const response = await page.request.get(`/api/routines?trainingPlanId=${planId}`);
  expect(response.ok()).toBe(true);
  const routines = (await response.json()) as RoutineSummaryShape[];
  return new Map(routines.map((routine) => [routine.id, routine.name]));
}

/** Same weekdays with the same routine names, regardless of the routine ids a version reuses. */
async function readWeekProfile(
  page: Page,
  plan: SavedPlanResult,
): Promise<[number, string | undefined][]> {
  const names = await getPlanRoutineNames(page, plan.plan.id);
  return plan.schedule.map((scheduled) => [
    scheduled.dayOfWeek,
    scheduled.routineId === null ? undefined : names.get(scheduled.routineId),
  ]);
}

async function getToday(page: Page): Promise<TodaySnapshot> {
  const response = await page.request.get('/api/today');
  expect(response.ok()).toBe(true);
  return (await response.json()) as TodaySnapshot;
}

async function openGuidedComposer(page: Page): Promise<void> {
  const [preferencesResponse] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith('/api/profile/preferences') &&
        candidate.request().method() === 'GET',
    ),
    page.goto('/dashboard/plan/guided'),
  ]);
  expect(preferencesResponse.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Crear plan con Coach Atlas' })).toBeVisible();
  // The brief is only settled once the preference prefill has been applied: the loading
  // placeholder is gone and the retry affordance of a failed load never appeared.
  await expect(page.getByText('Cargando preferencias…')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reintentar preferencias' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Generar plan semanal' })).toBeEnabled();
}

async function expectBriefPrefill(
  page: Page,
  expected: { goal: string; days: string; equipment: string },
): Promise<void> {
  await expect(page.locator('#guided-goal')).toHaveValue(expected.goal);
  await expect(page.locator('#guided-days')).toHaveValue(expected.days);
  await expect(page.locator('#guided-equipment')).toHaveValue(expected.equipment);
}

async function readBriefValues(page: Page): Promise<Record<string, string>> {
  return {
    goal: await page.locator('#guided-goal').inputValue(),
    days: await page.locator('#guided-days').inputValue(),
    experience: await page.getByLabel('Experiencia').inputValue(),
    equipment: await page.locator('#guided-equipment').inputValue(),
    length: await page.locator('#guided-length').inputValue(),
    focus: await page.locator('#guided-focus').inputValue(),
  };
}

async function generateDraft(page: Page): Promise<WeeklyPlanDraft> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith('/api/training-plan/generate') &&
        candidate.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Generar plan semanal' }).click(),
  ]);
  expect(response.status()).toBe(200);
  return (await response.json()) as WeeklyPlanDraft;
}

interface SaveOutcome {
  saved: SavedPlanResult;
  /** Every browser dialog the save raised, in order. */
  dialogMessages: string[];
}

/**
 * Saves the reviewed week through the product UI and returns the persisted active plan.
 *
 * The composer swaps to its success step and immediately routes to Today, so the
 * reliable product-visible signal is the guided POST plus the resulting navigation.
 */
async function saveReviewedDraft(page: Page): Promise<SaveOutcome> {
  const dialogMessages: string[] = [];
  const onDialog = (dialog: Dialog): void => {
    dialogMessages.push(dialog.message());
    void dialog.accept();
  };
  page.on('dialog', onDialog);
  try {
    const [response] = await Promise.all([
      page.waitForResponse(
        (candidate) =>
          candidate.url().endsWith('/api/training-plan/guided') &&
          candidate.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Guardar plan' }).click(),
    ]);
    expect(response.status()).toBe(200);
    await page.waitForURL('/dashboard/today', { timeout: 30_000 });
    await expect(page.getByTestId('welcome-message')).toBeVisible();
  } finally {
    page.off('dialog', onDialog);
  }

  const saved = await getActivePlan(page);
  if (!saved) {
    throw new Error('the guided composer did not persist an active plan');
  }
  return { saved, dialogMessages };
}

/** Generates a week with the real composer and saves it through the product UI. */
async function composeAndSaveCoachPlan(
  page: Page,
  input: { goal: string; focus?: string },
): Promise<SavedPlanResult> {
  await openGuidedComposer(page);
  await page.locator('#guided-goal').fill(input.goal);
  if (input.focus) {
    await page.locator('#guided-focus').fill(input.focus);
  }
  await generateDraft(page);
  const outcome = await saveReviewedDraft(page);
  // No active plan existed yet, so saving must not ask for a replacement confirmation.
  expect(outcome.dialogMessages).toEqual([]);
  return outcome.saved;
}

test.describe('Plan / Coach / Profile integration', () => {
  test('fresh user walks onboarding → Coach preview → Coach save → Profile edit → guided plan reflecting the updated profile', async ({
    page,
    browser,
  }) => {
    test.setTimeout(300_000);

    const user = createTestUser('golden');
    await registerUser(page, user);

    await page.waitForURL('/onboarding', { timeout: 30_000 });
    await completeOnboarding(page, { goal: 'muscle', pace: 'days-3', equipment: 'gym' });

    // Today is the product entry point for the freshly onboarded user: no plan yet.
    await expect(page.getByTestId('welcome-message')).toHaveText(`Hola, ${user.name}`);
    const freshToday = await getToday(page);
    expect(freshToday.kind).toBe('no_plan');
    const todayDayOfWeek = freshToday.dayOfWeek;
    expect(await getActivePlan(page)).toBeNull();
    await expect(page.getByRole('heading', { name: 'Todavía no tenés un plan' })).toBeVisible();

    // Coach Atlas plan: the brief arrives prefilled from the persisted onboarding answers.
    await page.getByRole('button', { name: 'Crear mi plan' }).click();
    await expect(page).toHaveURL('/dashboard/plan/new');
    await expect(page.getByRole('heading', { name: 'Armá tu semana con guía' })).toBeVisible();
    await page.getByRole('link', { name: 'Crear con Coach Atlas (guiado)' }).click();
    await expect(page).toHaveURL('/dashboard/plan/guided');
    await expect(page.getByRole('heading', { name: 'Crear plan con Coach Atlas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generar plan semanal' })).toBeEnabled();

    // The brief is prefilled from the answers persisted during onboarding.
    await expectBriefPrefill(page, {
      goal: 'Ganar músculo',
      days: '3',
      equipment: BRIEF_EQUIPMENT_PREFILLED,
    });
    const prefilled = await readBriefValues(page);
    expect(prefilled.experience).toBe(BRIEF_EXPERIENCE);
    expect(prefilled.length).toBe(BRIEF_LENGTH_MINUTES);
    expect(prefilled.focus).toBe('');

    // The brief stays editable after the prefill.
    await page.locator('#guided-goal').fill(BRIEF_GOAL);
    await page.locator('#guided-focus').fill(BRIEF_FOCUS);

    // Preview-only: generating a proposal must not create a plan.
    const draft = await generateDraft(page);
    expect(draft.source).toBe('fallback');
    expect(draft.goal).toBe(BRIEF_GOAL);
    expect(draft.name).toBe(`${COACH_PLAN_NAME_PREFIX}${BRIEF_GOAL}`);
    expect(draft.days).toHaveLength(BRIEF_DAYS);
    expect(draft.days.map((day) => day.dayOfWeek)).toEqual([1, 3, 5]);
    // The composer cycles the requested focus labels across the training days.
    expect(draft.days.map((day) => day.focus)).toEqual(['Pecho', 'Espalda', 'Pecho']);
    expect(draft.days.map((day) => day.title)).toEqual([
      'Día 1 · Pecho',
      'Día 2 · Espalda',
      'Día 3 · Pecho',
    ]);
    for (const day of draft.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
      for (const exercise of day.exercises) {
        expect(exercise.exerciseName.length).toBeGreaterThan(0);
        expect(exercise.targetSets).toBeGreaterThan(0);
        expect(exercise.targetReps).toBeGreaterThan(0);
      }
    }
    expect(await getActivePlan(page)).toBeNull();
    expect((await getToday(page)).kind).toBe('no_plan');

    // Review step: GEMINI_API_KEY is empty, so provenance must be truthful about the fallback.
    await expect(page.getByText('Respaldo determinista de Atlas')).toBeVisible();
    await expect(page.getByText('Propuesta de Gemini')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Revisá la semana propuesta' })).toBeVisible();
    await expect(page.getByText(`Objetivo indicado: ${BRIEF_GOAL}.`)).toBeVisible();
    await expect(page.getByRole('heading', { name: draft.days[0].title })).toBeVisible();
    await expect(page.getByText(draft.days[0].exercises[0].exerciseName).first()).toBeVisible();

    // Save the reviewed week.
    const firstSave = await saveReviewedDraft(page);
    expect(firstSave.dialogMessages).toEqual([]);
    const saved = firstSave.saved;
    expect(saved.plan.name).toBe(`${COACH_PLAN_NAME_PREFIX}${BRIEF_GOAL}`);
    expect(saved.plan.goal).toBe(BRIEF_GOAL);
    expect(saved.plan.isActive).toBe(true);
    expect(saved.schedule.map((scheduled) => scheduled.dayOfWeek)).toEqual([1, 3, 5]);
    const savedRoutineNames = await getPlanRoutineNames(page, saved.plan.id);
    for (const scheduled of saved.schedule) {
      expect(scheduled.routineId).not.toBeNull();
      expect(savedRoutineNames.get(scheduled.routineId ?? -1)).toMatch(
        new RegExp(`^${GUIDED_ROUTINE_PREFIX}`),
      );
      // The saved note carries the reviewed day title and focus.
      expect(scheduled.note).toContain('Día ');
    }

    // Today reflects the saved context, but only when today is part of the saved week.
    const scheduledForToday = saved.schedule.find(
      (scheduled) => scheduled.dayOfWeek === todayDayOfWeek,
    );
    const todaySnapshot = await getToday(page);
    await page.goto('/dashboard/today');
    await expect(page.getByTestId('welcome-message')).toBeVisible();
    if (scheduledForToday && scheduledForToday.routineId !== null) {
      const expectedRoutineName = savedRoutineNames.get(scheduledForToday.routineId);
      expect(expectedRoutineName).toBeDefined();
      expect(todaySnapshot.kind).toBe('workout');
      expect(todaySnapshot.routineId).toBe(scheduledForToday.routineId);
      expect(todaySnapshot.routineName).toBe(expectedRoutineName);
      await expect(
        page.getByRole('heading', { name: expectedRoutineName ?? '' }),
      ).toBeVisible();
    } else {
      expect(todaySnapshot.kind).toBe('rest_day');
      await expect(page.getByRole('heading', { name: 'Hoy es día de descanso' })).toBeVisible();
    }

    // Profile: update the saved preferences that Coach Atlas reads.
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
    const preferencesGroup = page.getByTestId('profile-preferences');
    await expect(preferencesGroup.getByText('Guardadas en tu perfil')).toBeVisible();
    await preferencesGroup.getByRole('button', { name: 'Editar preferencias' }).click();
    await preferencesGroup.locator('#profile-preference-goal').selectOption('fitness');
    await preferencesGroup.locator('#profile-preference-pace').selectOption('days-4');
    await preferencesGroup.locator('#profile-preference-equipment').selectOption('dumbbells');
    await preferencesGroup.getByTestId('profile-preferences-save').click();
    await expect(preferencesGroup.getByRole('status')).toContainText('Preferencias guardadas.');
    await expect(preferencesGroup.getByText('Guardadas en tu perfil')).toBeVisible();

    const updatedPreferences = { goal: 'fitness', pace: 'days-4', equipment: 'dumbbells' } as const;
    expect(await getPreferences(page)).toEqual({
      hasSavedPreferences: true,
      preferences: updatedPreferences,
    });

    // Persistence across a fresh browser context (a new device for the same user).
    const secondContext = await browser.newContext({ storageState: undefined });
    const secondPage = await secondContext.newPage();
    await loginUser(secondPage, user);
    expect(await getPreferences(secondPage)).toEqual({
      hasSavedPreferences: true,
      preferences: updatedPreferences,
    });
    expect((await getActivePlan(secondPage))?.plan.id).toBe(saved.plan.id);
    await secondContext.close();

    // Guided generation reflects the profile the user just updated.
    await openGuidedComposer(page);
    await expectBriefPrefill(page, {
      goal: 'Mejorar condición física',
      days: '4',
      equipment: PROFILE_BRIEF_EQUIPMENT,
    });
    const regenerated = await readBriefValues(page);
    expect(regenerated.experience).toBe(BRIEF_EXPERIENCE);
    expect(regenerated.length).toBe(BRIEF_LENGTH_MINUTES);

    await page.locator('#guided-goal').fill(PROFILE_BRIEF_GOAL);
    await page.locator('#guided-focus').fill(PROFILE_BRIEF_FOCUS);
    const profileDraft = await generateDraft(page);
    expect(profileDraft.source).toBe('fallback');
    expect(profileDraft.days).toHaveLength(4);
    expect(profileDraft.days.map((day) => day.dayOfWeek)).toEqual([1, 2, 4, 5]);
    // Four days collapse the two lower-body labels into a single per-day focus label.
    expect(profileDraft.days.map((day) => day.focus)).toEqual([
      'Piernas',
      'Piernas',
      'Piernas',
      'Piernas',
    ]);
    // Both requested muscles still drive the exercise selection.
    const profileMuscleGroups = new Set(
      profileDraft.days.flatMap((day) => day.exercises.map((exercise) => exercise.muscleGroup)),
    );
    expect(profileMuscleGroups.has('Piernas')).toBe(true);
    expect(profileMuscleGroups.has('Glúteos')).toBe(true);
    expect(profileDraft.days.every((day) => day.exercises.length >= 4)).toBe(true);
    expect(profileDraft.name).toBe(`${COACH_PLAN_NAME_PREFIX}${PROFILE_BRIEF_GOAL}`);

    // Saving the second week replaces the active plan, so the product asks for confirmation first.
    const secondSave = await saveReviewedDraft(page);
    expect(secondSave.dialogMessages).toEqual([TRAINING_PLAN_REPLACEMENT_CONFIRMATION]);
    expect(secondSave.saved.plan.id).not.toBe(saved.plan.id);
    expect(secondSave.saved.plan.name).toBe(`${COACH_PLAN_NAME_PREFIX}${PROFILE_BRIEF_GOAL}`);
    expect(secondSave.saved.plan.goal).toBe(PROFILE_BRIEF_GOAL);
    expect(secondSave.saved.plan.isActive).toBe(true);
    expect(secondSave.saved.schedule.map((scheduled) => scheduled.dayOfWeek)).toEqual([1, 2, 4, 5]);

    // The replaced version is archived but stays reachable to its owner.
    const replacedResponse = await page.request.get(`/api/training-plan/${saved.plan.id}`);
    expect(replacedResponse.ok()).toBe(true);
    const replacedPlan = (await replacedResponse.json()) as SavedPlanResult;
    expect(replacedPlan.plan.id).toBe(saved.plan.id);
    expect(replacedPlan.plan.isActive).toBe(false);
  });

  test('a plan without saved preferences falls back to Coach Atlas defaults', async ({ page }) => {
    await registerUser(page, createTestUser('defaults'));
    await page.waitForURL('/onboarding', { timeout: 30_000 });
    await skipOnboarding(page);

    // Onboarding was skipped, so no preference row was persisted.
    expect(await getPreferences(page)).toEqual({
      hasSavedPreferences: false,
      preferences: { goal: null, pace: null, equipment: null },
    });

    await page.goto('/dashboard/settings');
    const preferencesGroup = page.getByTestId('profile-preferences');
    await expect(
      preferencesGroup.getByText('Todavía no guardaste preferencias de Coach.'),
    ).toBeVisible();
    await expect(
      preferencesGroup.getByRole('button', { name: 'Definir preferencias' }),
    ).toBeVisible();

    await openGuidedComposer(page);
    expect(await readBriefValues(page)).toEqual({
      goal: '',
      days: '3',
      experience: BRIEF_EXPERIENCE,
      equipment: BRIEF_EQUIPMENT_INITIAL,
      length: BRIEF_LENGTH_MINUTES,
      focus: '',
    });

    // The empty goal is rejected by the server instead of silently generating.
    const [invalid] = await Promise.all([
      page.waitForResponse(
        (candidate) =>
          candidate.url().endsWith('/api/training-plan/generate') &&
          candidate.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Generar plan semanal' }).click(),
    ]);
    expect(invalid.status()).toBe(400);
    await expect(page.getByTestId('form-error')).toContainText('Brief semanal inválido');

    await page.locator('#guided-goal').fill(BRIEF_GOAL);
    const draft = await generateDraft(page);
    expect(draft.source).toBe('fallback');
    expect(draft.days).toHaveLength(3);
    expect(await getActivePlan(page)).toBeNull();

    const outcome = await saveReviewedDraft(page);
    // No plan existed before, so the product must not ask for a replacement confirmation.
    expect(outcome.dialogMessages).toEqual([]);
    expect(outcome.saved.plan.goal).toBe(BRIEF_GOAL);
    expect(outcome.saved.plan.isActive).toBe(true);
  });

  test('Coach Atlas week is preview-only until saved, and provenance stays truthful when Gemini is unavailable', async ({
    page,
  }) => {
    await registerUser(page, createTestUser('preview'));
    await page.waitForURL('/onboarding', { timeout: 30_000 });
    await skipOnboarding(page);

    await openGuidedComposer(page);
    await page.locator('#guided-goal').fill(BRIEF_GOAL);
    await page.locator('#guided-days').fill(String(BRIEF_DAYS));

    const draft = await generateDraft(page);
    // CI runs the app with GEMINI_API_KEY='', so the deterministic fallback is the real path.
    expect(draft.source).toBe('fallback');
    expect(draft.name).toBe(`${COACH_PLAN_NAME_PREFIX}${BRIEF_GOAL}`);
    expect(draft.days).toHaveLength(BRIEF_DAYS);

    await expect(page.getByText('Respaldo determinista de Atlas')).toBeVisible();
    await expect(page.getByText('Propuesta de Gemini')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Guardar plan' })).toBeVisible();

    // Nothing reaches the account while the proposal is still a preview.
    expect(await getActivePlan(page)).toBeNull();
    expect((await getToday(page)).kind).toBe('no_plan');
    const routinesResponse = await page.request.get('/api/routines');
    expect(routinesResponse.ok()).toBe(true);
    const routines = (await routinesResponse.json()) as { id: number; name: string }[];
    expect(routines.some((routine) => routine.name.startsWith(GUIDED_ROUTINE_PREFIX))).toBe(false);

    // Adjusting the brief returns to a still-unsaved preview.
    await page.getByRole('button', { name: 'Ajustar brief' }).click();
    await expect(page.getByRole('heading', { name: 'Crear plan con Coach Atlas' })).toBeVisible();
    await expect(page.locator('#guided-goal')).toHaveValue(BRIEF_GOAL);
    expect(await getActivePlan(page)).toBeNull();

    await generateDraft(page);
    const outcome = await saveReviewedDraft(page);
    expect(outcome.dialogMessages).toEqual([]);
    const saved = outcome.saved;
    expect(saved.plan.name).toBe(`${COACH_PLAN_NAME_PREFIX}${BRIEF_GOAL}`);
    expect(saved.schedule).toHaveLength(BRIEF_DAYS);
    const savedRoutineNames = await getPlanRoutineNames(page, saved.plan.id);
    for (const scheduled of saved.schedule) {
      expect(scheduled.routineId).not.toBeNull();
      expect(savedRoutineNames.get(scheduled.routineId ?? -1)).toMatch(
        new RegExp(`^${GUIDED_ROUTINE_PREFIX}`),
      );
    }
  });

  test('logout and login restore the same profile, plan and Coach preferences', async ({ page }) => {
    const user = createTestUser('session');
    await registerUser(page, user);
    await page.waitForURL('/onboarding', { timeout: 30_000 });
    await completeOnboarding(page, { goal: 'strength', pace: 'days-4', equipment: 'dumbbells' });

    const savedBefore = await composeAndSaveCoachPlan(page, { goal: BRIEF_GOAL });

    await logoutUser(page);
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
    expect((await page.request.get('/api/profile/preferences')).status()).toBe(401);
    expect((await page.request.get('/api/training-plan/active')).status()).toBe(401);
    await page.goto('/dashboard/today');
    await expect(page).toHaveURL(/\/login/);

    await loginUser(page, user);
    expect(await getPreferences(page)).toEqual({
      hasSavedPreferences: true,
      preferences: { goal: 'strength', pace: 'days-4', equipment: 'dumbbells' },
    });
    const savedAfter = await getActivePlan(page);
    expect(savedAfter?.plan.id).toBe(savedBefore.plan.id);
    expect(savedAfter?.plan.isActive).toBe(true);
    expect(savedAfter?.schedule).toEqual(savedBefore.schedule);

    await openGuidedComposer(page);
    await expectBriefPrefill(page, {
      goal: 'Ganar fuerza',
      days: '4',
      equipment: PROFILE_BRIEF_EQUIPMENT,
    });
  });

  test('coach-generated plans and routines stay scoped to their owner', async ({ browser, page }) => {
    await registerUser(page, createTestUser('owner-a'));
    await page.waitForURL('/onboarding', { timeout: 30_000 });
    await skipOnboarding(page);

    const owned = await composeAndSaveCoachPlan(page, { goal: BRIEF_GOAL });
    const ownedRoutine = owned.schedule[0];
    const ownedRoutineNames = await getPlanRoutineNames(page, owned.plan.id);
    expect(ownedRoutineNames.get(ownedRoutine.routineId ?? -1)).toMatch(
      new RegExp(`^${GUIDED_ROUTINE_PREFIX}`),
    );
    const ownedRoutineId = ownedRoutine.routineId;
    expect(ownedRoutineId).not.toBeNull();

    const anonContext: BrowserContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    expect((await anonPage.request.get(`/api/training-plan/${owned.plan.id}`)).status()).toBe(401);
    expect((await anonPage.request.get('/api/routines')).status()).toBe(401);
    expect((await anonPage.request.get('/api/today')).status()).toBe(401);
    await anonContext.close();

    const otherContext: BrowserContext = await browser.newContext({ storageState: undefined });
    const otherPage = await otherContext.newPage();
    await registerUser(otherPage, createTestUser('owner-b'));
    await otherPage.waitForURL('/onboarding', { timeout: 30_000 });
    await skipOnboarding(otherPage);
    expect(await getActivePlan(otherPage)).toBeNull();

    // Another user cannot read, list or overwrite the first user's plan or routine.
    expect((await otherPage.request.get(`/api/training-plan/${owned.plan.id}`)).status()).toBe(404);
    // A malformed edit body is rejected before ownership is even considered.
    expect(
      (
        await otherPage.request.patch(`/api/training-plan/${owned.plan.id}`, {
          data: { name: 'Plan robado' },
        })
      ).status(),
    ).toBe(400);
    // The same edit with a well-formed body is refused as a missing resource.
    expect(
      (
        await otherPage.request.patch(`/api/training-plan/${owned.plan.id}`, {
          data: {
            name: 'Plan robado',
            goal: 'objetivo ajeno',
            mutationId: '00000000-0000-4000-8000-000000000001',
            replacePlanId: owned.plan.id,
            replacePlanUpdatedAt: owned.plan.updatedAt,
            replacePlanStateHash: owned.replacementStateHash,
            schedule: owned.schedule.map((scheduled) => ({
              dayOfWeek: scheduled.dayOfWeek,
              routineId: scheduled.routineId,
              note: scheduled.note ?? undefined,
            })),
          },
        })
      ).status(),
    ).toBe(404);
    expect((await otherPage.request.get(`/api/routines/${ownedRoutineId}`)).status()).toBe(404);
    // Plan-scoped Coach routines are neither listed for another user nor for a foreign plan scope.
    expect(
      (
        await otherPage.request.get(`/api/routines?trainingPlanId=${owned.plan.id}`)
      ).status(),
    ).toBe(404);
    const otherRoutines = (await (await otherPage.request.get('/api/routines')).json()) as {
      id: number;
    }[];
    expect(otherRoutines.some((routine) => routine.id === ownedRoutineId)).toBe(false);
    expect((await getToday(otherPage)).kind).toBe('no_plan');

    // The owner still sees exactly the same plan and routine.
    const readBack = (await (
      await page.request.get(`/api/training-plan/${owned.plan.id}`)
    ).json()) as SavedPlanResult;
    expect(readBack.plan.id).toBe(owned.plan.id);
    expect(readBack.plan.isActive).toBe(true);
    expect(readBack.schedule).toEqual(owned.schedule);
    // The same routine id is readable for its owner inside the plan scope (the mirror of the 404 above).
    expect(
      (
        await page.request.get(`/api/routines/${ownedRoutineId}?trainingPlanId=${owned.plan.id}`)
      ).status(),
    ).toBe(200);
    const ownedRoutines = (await (
      await page.request.get(`/api/routines?trainingPlanId=${owned.plan.id}`)
    ).json()) as { id: number }[];
    expect(ownedRoutines.some((routine) => routine.id === ownedRoutineId)).toBe(true);

    await otherContext.close();
  });

  test('manual plan lifecycle keeps working: navigable, mutable, archivable, without touching the Coach plan week', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    await registerUser(page, createTestUser('manual'));
    await page.waitForURL('/onboarding', { timeout: 30_000 });
    await skipOnboarding(page);

    const todayDayOfWeek = (await getToday(page)).dayOfWeek;
    const coachPlan = await composeAndSaveCoachPlan(page, { goal: BRIEF_GOAL });
    const flaggedDay = coachPlan.schedule[0];
    expect(flaggedDay.routineId).not.toBeNull();
    const flaggedRoutineId = flaggedDay.routineId;
    const flaggedRoutineName = (await getPlanRoutineNames(page, coachPlan.plan.id)).get(
      flaggedRoutineId ?? -1,
    );
    expect(flaggedRoutineName).toMatch(new RegExp(`^${GUIDED_ROUTINE_PREFIX}`));

    // Manual navigation: the hub lists the week and exposes the plan actions.
    await page.goto(`/dashboard/plan/${coachPlan.plan.id}`);
    await expect(page.getByRole('heading', { name: coachPlan.plan.name })).toBeVisible();
    await expect(page.getByText('Plan activo').first()).toBeVisible();
    await expect(page.getByTestId('plan-hub-week-grid').getByRole('listitem')).toHaveCount(7);
    await expect(page.getByText(flaggedRoutineName ?? '')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editar plan semanal' })).toBeVisible();

    // Manual mutability: the edit form is prefilled, but a plan-scoped routine is not editable here.
    await page.getByRole('link', { name: 'Editar plan semanal' }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/plan/${coachPlan.plan.id}/edit$`));
    const form = page.getByTestId('plan-builder-form');
    await expect(form).toBeVisible();
    await expect(form.getByTestId('plan-name-input')).toHaveValue(coachPlan.plan.name);
    await expect(form.getByRole('link', { name: `Ver rutina ${flaggedRoutineName}` })).toBeVisible();
    await expect(form.getByRole('link', { name: 'Editar rutina' })).toHaveCount(0);

    // Moving the assigned routine onto today's weekday is a deterministic, product-visible edit.
    if (!coachPlan.schedule.some((scheduled) => scheduled.dayOfWeek === todayDayOfWeek)) {
      await form
        .getByTestId(`plan-day-select-${todayDayOfWeek}`)
        .selectOption(String(flaggedRoutineId));
    }
    await expect(form.getByTestId('plan-summary')).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (candidate) =>
          candidate.url().endsWith('/api/training-plan') && candidate.request().method() === 'POST',
      ),
      form.getByTestId('plan-submit').click(),
    ]);
    expect(createResponse.status()).toBe(200);
    await expect(page).toHaveURL(/\/dashboard\/plan\/\d+$/);

    // Editing produced a new active version and kept the previous one reachable and inactive.
    const replacement = await getActivePlan(page);
    if (!replacement) {
      throw new Error('the manual edit did not leave an active plan');
    }
    expect(replacement.plan.id).not.toBe(coachPlan.plan.id);
    const previousResponse = await page.request.get(`/api/training-plan/${coachPlan.plan.id}`);
    expect(previousResponse.ok()).toBe(true);
    expect(((await previousResponse.json()) as SavedPlanResult).plan.isActive).toBe(false);
    // The edit clones the assigned routines into the new version, so routine ids are
    // version-scoped: the week must be compared by day/routine name instead.
    const originalWeek = await readWeekProfile(page, coachPlan);
    const replacementWeek = await readWeekProfile(page, replacement);
    for (const entry of originalWeek) {
      expect(replacementWeek).toContainEqual(entry);
    }
    expect(replacementWeek).toContainEqual([todayDayOfWeek, flaggedRoutineName]);
    expect(replacementWeek).toHaveLength(
      coachPlan.schedule.some((scheduled) => scheduled.dayOfWeek === todayDayOfWeek)
        ? originalWeek.length
        : originalWeek.length + 1,
    );

    const todayAfterEdit = await getToday(page);
    expect(todayAfterEdit.kind).toBe('workout');
    expect(todayAfterEdit.routineName).toBe(flaggedRoutineName);
    expect(todayAfterEdit.routineId).toBe(
      replacement.schedule.find((scheduled) => scheduled.dayOfWeek === todayDayOfWeek)?.routineId,
    );
    await page.goto('/dashboard/today');
    await expect(page.getByTestId('welcome-message')).toBeVisible();
    await expect(page.getByRole('heading', { name: flaggedRoutineName ?? '' })).toBeVisible();

    // Archived plans disappear from the active slot but stay reachable and user-scoped.
    await page.goto(`/dashboard/plan/${replacement.plan.id}`);
    page.once('dialog', (dialog) => void dialog.accept());
    const [archiveResponse] = await Promise.all([
      page.waitForResponse(
        (candidate) =>
          candidate.url().endsWith('/archive') && candidate.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Finalizar / Archivar plan' }).click(),
    ]);
    expect(archiveResponse.status()).toBe(200);
    await expect(page).toHaveURL('/dashboard/plan/new', { timeout: 30_000 });
    expect(await getActivePlan(page)).toBeNull();
    expect((await page.request.get('/api/training-plan/active')).status()).toBe(204);
    expect((await getToday(page)).kind).toBe('no_plan');
    const archivedResponse = await page.request.get(`/api/training-plan/${replacement.plan.id}`);
    expect(archivedResponse.ok()).toBe(true);
    expect(((await archivedResponse.json()) as SavedPlanResult).plan.isActive).toBe(false);
  });
});
