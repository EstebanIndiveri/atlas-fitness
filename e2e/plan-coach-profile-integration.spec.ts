import { expect, test, type Dialog, type Page } from '@playwright/test';

import { completeOnboardingForCurrentUser } from './helpers/auth';

/**
 * Phase 4 integration QA — plan ↔ Coach Atlas ↔ profile preferences.
 *
 * Every test registers its own fresh user so the ownership, onboarding and
 * preference state of one scenario can never leak into another.
 */

const PASSWORD = 'Test1234!';

const GOAL_TITLE = { strength: 'Ganar fuerza', fitness: 'Mejorar condición física' } as const;
const PACE_TITLE = { days2: '2 días por semana', days5: '5 o más días' } as const;
const EQUIPMENT_TITLE = {
  gym: 'Gimnasio completo',
  dumbbells: 'Mancuernas en casa',
  bands: 'Bandas elásticas',
} as const;

const FALLBACK_PROVENANCE = 'Respaldo determinista de Atlas';
const GEMINI_PROVENANCE =
  'Propuesta de Gemini · catálogo y objetivos validados y normalizados por Atlas';
/**
 * Equipment default of the guided brief when the user has no saved preference.
 *
 * This is the canonical lowercase equipment token, not the onboarding display label:
 * `useGuidedPlan` initialises the form with `gimnasio completo`, while the
 * preference prefill maps the stored option id to its onboarding title.
 */
const DEFAULT_EQUIPMENT_TOKEN = 'gimnasio completo';
const REPLACEMENT_CONFIRM_PREFIX =
  'Al confirmar, el plan activo se archivará y esta nueva versión quedará activa.';

interface PreferencesBody {
  hasSavedPreferences: boolean;
  preferences: { goal: string; pace: string; equipment: string } | null;
}

interface WeeklyDraft {
  source: string;
  name: string;
  goal: string;
  days: {
    dayOfWeek: number;
    title: string;
    focus: string;
    exercises: { exerciseName: string; muscleGroup: string; targetSets: number; targetReps: number }[];
  }[];
}

interface ActivePlanBody {
  plan: { id: number; name: string; goal: string | null; isActive: boolean };
  schedule?: { dayOfWeek: number; routineId: number | null }[];
  days?: { dayOfWeek: number; title: string | null; assignment: { routineId: number | null } | null }[];
}

async function registerUser(page: Page, label: string): Promise<string> {
  const email = `plan-coach-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`;
  await page.goto('/register');
  await page.fill('input[type="text"]', `Plan Coach ${label}`);
  await page.fill('input[type="email"]', email);
  await page.locator('input[type="password"]').nth(0).fill(PASSWORD);
  await page.locator('input[type="password"]').nth(1).fill(PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/auth/register') && response.status() === 201,
    ),
    page.waitForURL('/onboarding', { timeout: 15000 }),
    page.getByRole('button', { name: 'Crear cuenta' }).click(),
  ]);
  return email;
}

async function finishOnboardingWithAnswers(
  page: Page,
  answers: { goal: string; pace: string; equipment: string },
): Promise<void> {
  await expect(page.getByTestId('onboarding-wizard')).toBeVisible();
  for (const title of [answers.goal, answers.pace, answers.equipment]) {
    await page.getByTestId('onboarding-option').filter({ hasText: title }).click();
    await page.getByTestId('onboarding-continue').click();
  }
  await expect(page.getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/profile/onboarding') && response.request().method() === 'POST',
    ),
    page.waitForURL('/dashboard/today', { timeout: 15000 }),
    page.getByTestId('onboarding-continue').click(),
  ]);
  await expect(page.getByTestId('welcome-message')).toBeVisible({ timeout: 10000 });
}

async function login(page: Page, email: string): Promise<void> {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/api/auth/login') && response.status() === 200,
    ),
    page.waitForURL('/dashboard/today', { timeout: 15000 }),
    page.getByRole('button', { name: 'Ingresar' }).click(),
  ]);
  await expect(page.getByTestId('welcome-message')).toBeVisible({ timeout: 10000 });
}

async function logout(page: Page): Promise<void> {
  await Promise.all([
    page.waitForURL('/login', { timeout: 15000 }),
    page.getByRole('button', { name: 'Cerrar sesión' }).click(),
  ]);
}

async function readPreferences(page: Page): Promise<PreferencesBody> {
  const response = await page.request.get('/api/profile/preferences');
  expect(response.status()).toBe(200);
  return (await response.json()) as PreferencesBody;
}

async function savePreferences(
  page: Page,
  values: { goal: string; pace: string; equipment: string },
): Promise<void> {
  await page.goto('/dashboard/settings');
  await expect(page.getByRole('heading', { name: 'Mi Atlas' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /^(Editar|Definir) preferencias$/ }).click();
  await page.selectOption('#profile-preference-goal', values.goal);
  await page.selectOption('#profile-preference-pace', values.pace);
  await page.selectOption('#profile-preference-equipment', values.equipment);
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith('/api/profile/preferences') &&
        candidate.request().method() === 'PUT',
    ),
    page.getByTestId('profile-preferences-save').click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByText('Preferencias guardadas.')).toBeVisible();
}

async function expectNoActivePlan(page: Page): Promise<void> {
  const response = await page.request.get('/api/training-plan/active');
  expect(response.status()).toBe(204);
}

async function readActivePlan(page: Page): Promise<ActivePlanBody> {
  const response = await page.request.get('/api/training-plan/active');
  expect(response.status()).toBe(200);
  return (await response.json()) as ActivePlanBody;
}

async function openGuidedBrief(page: Page): Promise<void> {
  await page.goto('/dashboard/plan/guided');
  await expect(page.getByRole('heading', { name: 'Crear plan con Coach Atlas' })).toBeVisible({
    timeout: 15000,
  });
}

async function generateWeek(
  page: Page,
  brief: { goal?: string; days?: number; minutes?: number },
): Promise<WeeklyDraft> {
  if (brief.goal !== undefined) {
    await page.locator('#guided-goal').fill(brief.goal);
  }
  if (brief.days !== undefined) {
    await page.locator('#guided-days').fill(String(brief.days));
  }
  if (brief.minutes !== undefined) {
    await page.locator('#guided-length').fill(String(brief.minutes));
  }
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith('/api/training-plan/generate') &&
        candidate.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Generar plan semanal' }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Revisá la semana propuesta' })).toBeVisible({
    timeout: 15000,
  });
  return (await response.json()) as WeeklyDraft;
}

async function saveWeek(page: Page): Promise<{ dialogs: string[]; body: ActivePlanBody }> {
  const dialogs: string[] = [];
  const capture = (dialog: Dialog): void => {
    dialogs.push(dialog.message());
    void dialog.accept();
  };
  page.on('dialog', capture);
  try {
    const [response] = await Promise.all([
      page.waitForResponse(
        (candidate) =>
          candidate.url().endsWith('/api/training-plan/guided') &&
          candidate.request().method() === 'POST',
      ),
      page.waitForURL('/dashboard/today', { timeout: 20000 }),
      page.getByRole('button', { name: 'Guardar plan' }).click(),
    ]);
    expect(response.status()).toBe(200);
    return { dialogs, body: (await response.json()) as ActivePlanBody };
  } finally {
    page.off('dialog', capture);
  }
}

test('golden path: onboarding answers drive the Coach brief, the draft stays preview-only, and a saved plan persists', async ({
  page,
}) => {
  await registerUser(page, 'golden');
  await finishOnboardingWithAnswers(page, {
    goal: GOAL_TITLE.strength,
    pace: PACE_TITLE.days2,
    equipment: EQUIPMENT_TITLE.dumbbells,
  });

  const stored = await readPreferences(page);
  expect(stored.hasSavedPreferences).toBe(true);
  expect(stored.preferences).toEqual({ goal: 'strength', pace: 'days-2', equipment: 'dumbbells' });

  await expectNoActivePlan(page);

  await openGuidedBrief(page);
  await expect(page.locator('#guided-goal')).toHaveValue(GOAL_TITLE.strength);
  await expect(page.locator('#guided-days')).toHaveValue('2');
  await expect(page.locator('#guided-equipment')).toHaveValue(EQUIPMENT_TITLE.dumbbells);

  const draft = await generateWeek(page, { goal: GOAL_TITLE.strength, minutes: 45 });
  expect(draft.source).toBe('fallback');
  expect(draft.name).toBe(`Coach Atlas · ${GOAL_TITLE.strength}`);
  expect(draft.goal).toBe(GOAL_TITLE.strength);
  expect(draft.days.map((day) => day.dayOfWeek)).toEqual([1, 4]);
  await expect(page.getByText('Objetivo indicado: Ganar fuerza.')).toBeVisible();
  await expect(page.getByText(FALLBACK_PROVENANCE)).toBeVisible();
  await expect(page.getByText(GEMINI_PROVENANCE)).toHaveCount(0);

  // Preview-only: nothing is written until the user explicitly saves.
  await expectNoActivePlan(page);

  const { dialogs, body } = await saveWeek(page);
  expect(dialogs).toHaveLength(0);
  expect(body.plan.name).toBe(`Coach Atlas · ${GOAL_TITLE.strength}`);
  expect((body.schedule ?? []).filter((day) => day.routineId !== null)).toHaveLength(2);

  const active = await readActivePlan(page);
  expect(active.plan.name).toBe(`Coach Atlas · ${GOAL_TITLE.strength}`);
  expect(active.plan.isActive).toBe(true);
});

test('preferences edited after a plan is saved drive the next Coach generation', async ({ page }) => {
  await registerUser(page, 'prefs');
  await finishOnboardingWithAnswers(page, {
    goal: GOAL_TITLE.strength,
    pace: PACE_TITLE.days2,
    equipment: EQUIPMENT_TITLE.gym,
  });

  await openGuidedBrief(page);
  await generateWeek(page, { goal: GOAL_TITLE.strength });
  const first = await saveWeek(page);
  expect(first.dialogs).toHaveLength(0);
  expect(first.body.plan.name).toBe(`Coach Atlas · ${GOAL_TITLE.strength}`);

  await savePreferences(page, {
    goal: 'fitness',
    pace: 'days-5',
    equipment: 'bands',
  });
  const updated = await readPreferences(page);
  expect(updated.hasSavedPreferences).toBe(true);
  expect(updated.preferences).toEqual({ goal: 'fitness', pace: 'days-5', equipment: 'bands' });
  await expect(page.getByText('Guardadas en tu perfil')).toBeVisible();

  await openGuidedBrief(page);
  await expect(page.locator('#guided-goal')).toHaveValue(GOAL_TITLE.fitness);
  await expect(page.locator('#guided-days')).toHaveValue('5');
  await expect(page.locator('#guided-equipment')).toHaveValue(EQUIPMENT_TITLE.bands);

  const draft = await generateWeek(page, { goal: GOAL_TITLE.fitness, days: 5 });
  expect(draft.goal).toBe(GOAL_TITLE.fitness);
  expect(draft.days.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5]);
  // The orchestrator owns the week: one scheduled day per requested day, each
  // titled from its weekday and carrying at least one exercise.
  for (const day of draft.days) {
    expect(day.title.startsWith(`Día ${day.dayOfWeek} · `)).toBe(true);
    expect(day.focus.length).toBeGreaterThan(0);
    expect(day.exercises.length).toBeGreaterThan(0);
  }
  await expect(page.getByText('Objetivo indicado: Mejorar condición física.')).toBeVisible();
  await expect(page.getByText(FALLBACK_PROVENANCE)).toBeVisible();

  // The previously saved plan is still the active one — the new draft replaced nothing yet.
  const stillActive = await readActivePlan(page);
  expect(stillActive.plan.name).toBe(`Coach Atlas · ${GOAL_TITLE.strength}`);

  // Saving over an active plan must ask for the explicit replacement confirmation.
  const replacement = await saveWeek(page);
  expect(replacement.dialogs).toHaveLength(1);
  expect(replacement.dialogs[0]?.startsWith(REPLACEMENT_CONFIRM_PREFIX)).toBe(true);
  expect(replacement.body.plan.id).not.toBe(stillActive.plan.id);

  const activeAfterReplacement = await readActivePlan(page);
  expect(activeAfterReplacement.plan.id).toBe(replacement.body.plan.id);
  expect(activeAfterReplacement.plan.name).toBe(`Coach Atlas · ${GOAL_TITLE.fitness}`);
});

test('plan and routines survive a logout / login round trip', async ({ page }) => {
  const email = await registerUser(page, 'session');
  await finishOnboardingWithAnswers(page, {
    goal: GOAL_TITLE.strength,
    pace: PACE_TITLE.days2,
    equipment: EQUIPMENT_TITLE.gym,
  });

  await openGuidedBrief(page);
  await generateWeek(page, { goal: GOAL_TITLE.strength });
  const { body } = await saveWeek(page);
  const planId = body.plan.id;
  const routineIds = (body.schedule ?? [])
    .map((day) => day.routineId)
    .filter((id): id is number => id !== null);
  expect(routineIds.length).toBeGreaterThan(0);

  await savePreferences(page, { goal: 'strength', pace: 'days-5', equipment: 'bands' });

  await page.goto('/dashboard/today');
  await logout(page);
  await login(page, email);

  const active = await readActivePlan(page);
  expect(active.plan.id).toBe(planId);

  const preferences = await readPreferences(page);
  expect(preferences.hasSavedPreferences).toBe(true);
  expect(preferences.preferences).toEqual({ goal: 'strength', pace: 'days-5', equipment: 'bands' });

  await page.goto(`/dashboard/plan/${planId}`);
  await expect(page.getByRole('heading', { name: `Coach Atlas · ${GOAL_TITLE.strength}` })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText('Plan activo')).toBeVisible();
  await expect(page.getByTestId('plan-hub-week-grid')).toBeVisible();
});

test('cross-user ownership isolation: another account cannot read the plan or its routines', async ({
  page,
  browser,
}) => {
  await registerUser(page, 'owner-a');
  await finishOnboardingWithAnswers(page, {
    goal: GOAL_TITLE.strength,
    pace: PACE_TITLE.days2,
    equipment: EQUIPMENT_TITLE.gym,
  });

  await openGuidedBrief(page);
  await generateWeek(page, { goal: GOAL_TITLE.strength });
  const { body } = await saveWeek(page);
  const planId = body.plan.id;
  const routineId = (body.schedule ?? []).find((day) => day.routineId !== null)?.routineId;
  expect(routineId).toBeDefined();

  const intruderContext = await browser.newContext({
    storageState: './e2e/storage/onboarded.json',
  });
  const intruder = await intruderContext.newPage();
  try {
    await registerUser(intruder, 'owner-b');
    await completeOnboardingForCurrentUser(intruder);

    const planResponse = await intruder.request.get(`/api/training-plan/${planId}`);
    expect(planResponse.status()).toBe(404);
    expect(((await planResponse.json()) as { code: string }).code).toBe('NOT_FOUND');

    const scopedResponse = await intruder.request.get(
      `/api/routines/${String(routineId)}?trainingPlanId=${planId}`,
    );
    expect(scopedResponse.status()).toBe(404);

    await intruder.goto(`/dashboard/plan/${planId}`);
    await expect(intruder.getByText('Plan no encontrado')).toBeVisible({ timeout: 15000 });
    await expect(intruder.getByText('No existe o no está disponible para tu cuenta.')).toBeVisible();
  } finally {
    await intruderContext.close();
  }
});

test('profile without a preference row still loads and can define preferences for the first time', async ({
  page,
}) => {
  await registerUser(page, 'incomplete');
  await completeOnboardingForCurrentUser(page);

  await page.goto('/dashboard/plan/guided');
  // Defaults, not onboarding answers: the skipped wizard stored no preference row.
  await expect(page.locator('#guided-goal')).toHaveValue('', { timeout: 15000 });
  await expect(page.locator('#guided-days')).toHaveValue('3');
  await expect(page.locator('#guided-equipment')).toHaveValue(DEFAULT_EQUIPMENT_TOKEN);
  await expect(page.locator('#guided-length')).toHaveValue('55');
  await expect(page.getByLabel('Experiencia')).toHaveValue('intermediate');

  await page.goto('/dashboard/settings');
  const panel = page.getByTestId('profile-preferences');
  await expect(panel).toBeVisible({ timeout: 15000 });
  await expect(panel.getByText('Todavía no guardaste preferencias de Coach.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Definir preferencias' })).toBeVisible();
  // No preference row and not editing: the legacy browser-answer import prompt is
  // offered, but with nothing stored yet there is nothing to confirm.
  await expect(page.getByTestId('profile-review-legacy-import')).toBeVisible();
  await expect(page.getByTestId('profile-confirm-legacy-import')).toHaveCount(0);

  await savePreferences(page, { goal: 'strength', pace: 'days-2', equipment: 'dumbbells' });

  const stored = await readPreferences(page);
  expect(stored.hasSavedPreferences).toBe(true);
  expect(stored.preferences).toEqual({ goal: 'strength', pace: 'days-2', equipment: 'dumbbells' });
  await expect(page.getByText('Guardadas en tu perfil')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar preferencias' })).toBeVisible();

  await openGuidedBrief(page);
  await expect(page.locator('#guided-goal')).toHaveValue(GOAL_TITLE.strength);
  await expect(page.locator('#guided-days')).toHaveValue('2');
  await expect(page.locator('#guided-equipment')).toHaveValue(EQUIPMENT_TITLE.dumbbells);
});

test('manual plan navigation and routine mutability do not regress', async ({ page }) => {
  await registerUser(page, 'manual');
  await completeOnboardingForCurrentUser(page);

  const catalogResponse = await page.request.get('/api/exercises');
  expect(catalogResponse.status()).toBe(200);
  const catalog = (await catalogResponse.json()) as { id: number; name: string }[];
  expect(catalog.length).toBeGreaterThan(0);
  const exerciseId = catalog[0]!.id;
  expect(exerciseId).toBeGreaterThan(0);

  const created = (await (
    await page.request.post('/api/routines', {
      data: {
        name: `Rutina manual ${Date.now()}`,
        kind: 'gym',
        exercises: [
          {
            exerciseId,
            sortOrder: 0,
            targetSets: 3,
            targetReps: 10,
          },
        ],
      },
    })
  ).json()) as { id: number; name: string };
  expect(created.id).toBeGreaterThan(0);

  // No active plan: the built-in routine is mutable.
  await page.goto('/dashboard/plan/new');
  await expect(page.getByRole('link', { name: '← Volver a hoy' })).toHaveAttribute(
    'href',
    '/dashboard/today',
  );
  await expect(page.getByRole('link', { name: /Crear con Coach Atlas/ })).toHaveAttribute(
    'href',
    '/dashboard/plan/guided',
  );
  await expect(page.getByTestId('plan-builder-form')).toBeVisible({ timeout: 15000 });
  await page.selectOption('[data-testid="plan-day-select-2"]', String(created.id));
  await expect(page.getByRole('link', { name: `Ver rutina ${created.name}` })).toHaveAttribute(
    'href',
    `/dashboard/routines/${created.id}`,
  );
  await expect(page.getByRole('link', { name: `Editar rutina ${created.name}` })).toHaveAttribute(
    'href',
    `/dashboard/routines/${created.id}/edit`,
  );

  // With an active plan the day link must carry the mandatory plan scope.
  const plan = (await (
    await page.request.post('/api/training-plan', {
      data: {
        name: `Plan manual ${Date.now()}`,
        goal: 'Fuerza',
        schedule: [{ dayOfWeek: 2, routineId: created.id, note: 'Empuje' }],
      },
    })
  ).json()) as ActivePlanBody;
  const planId = plan.plan.id;
  expect(planId).toBeGreaterThan(0);

  await page.goto(`/dashboard/plan/${planId}`);
  await expect(page.getByRole('heading', { name: plan.plan.name })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Plan activo')).toBeVisible();
  await expect(page.getByTestId('plan-hub-week-grid')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu semana' })).toBeVisible();
  await expect(page.getByRole('link', { name: `Ver rutina ${created.name}` })).toHaveAttribute(
    'href',
    `/dashboard/routines/${created.id}?trainingPlanId=${planId}`,
  );
  await expect(page.getByRole('link', { name: 'Editar plan semanal' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Crear nuevo plan' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mejorar plan con Coach Atlas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizar / Archivar plan' })).toBeVisible();

  await page.goto(`/dashboard/plan/${planId}/edit`);
  await expect(page.getByTestId('plan-builder-form')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="plan-day-select-2"]')).toHaveValue(String(created.id));
  await expect(page.getByRole('link', { name: `Ver rutina ${created.name}` })).toHaveAttribute(
    'href',
    `/dashboard/routines/${created.id}?trainingPlanId=${planId}`,
  );
  await expect(page.getByRole('link', { name: `Editar rutina ${created.name}` })).toHaveCount(0);
});
