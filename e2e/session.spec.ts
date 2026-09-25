import { test, expect } from '@playwright/test';
import { expectCssColor, ATLAS_SMOKE } from './tailwind-smoke';

async function registerFreshUser(
  page: import('@playwright/test').Page,
  startOnboarding = false,
): Promise<void> {
  const testUser = {
    name: 'Guided E2E',
    email: `guided-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`,
    password: 'Test1234!',
  };

  await page.goto('/register');
  if (startOnboarding) {
    await page.evaluate(() => localStorage.removeItem('atlas:onboarding:welcome-done'));
  }
  await page.fill('input[type="text"]', testUser.name);
  await page.fill('input[type="email"]', testUser.email);
  const passwordInputs = await page.locator('input[type="password"]').all();
  await passwordInputs[0].fill(testUser.password);
  await passwordInputs[1].fill(testUser.password);
  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/register') && resp.status() === 201,
    ),
    page.waitForURL(startOnboarding ? '/onboarding' : '/dashboard/today', {
      timeout: 15000,
    }),
    page.locator('button[type="submit"]').click(),
  ]);
}

test.describe('Guided session (Epic-E Must)', () => {
  test('GET /api/routines returns seeded routines and active is 200+null', async ({ page }) => {
    await registerFreshUser(page);
    const active = await page.request.get('/api/workouts/active');
    expect(active.status()).toBe(200);
    expect(await active.json()).toBeNull();

    const routinesRes = await page.request.get('/api/routines');
    expect(routinesRes.status()).toBe(200);
    const routines = (await routinesRes.json()) as { slug: string; exercises: unknown[] }[];
    expect(routines.length).toBeGreaterThanOrEqual(2);
    expect(routines.some((routine) => routine.slug === 'full-body-expres')).toBe(true);
    const expres = routines.find((routine) => routine.slug === 'full-body-expres');
    expect(expres?.exercises.length).toBe(2);
  });

  test('pick routine → check sets → rest → next (fallback) → close with mood', async ({ page }) => {
    await registerFreshUser(page, true);
    await expect(page.getByTestId('onboarding-wizard')).toBeVisible();

    await page.getByTestId('onboarding-option').filter({ hasText: 'Ganar fuerza' }).click();
    await page.getByTestId('onboarding-continue').click();
    await page.getByRole('heading', { name: '¿Con qué frecuencia vas a entrenar?' }).waitFor();
    await page.getByTestId('onboarding-option').filter({ hasText: '3 días por semana' }).click();
    await page.getByTestId('onboarding-continue').click();
    await page.getByRole('heading', { name: '¿Con qué equipo contás?' }).waitFor();
    await page.getByTestId('onboarding-option').filter({ hasText: 'Gimnasio completo' }).click();
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible();

    await Promise.all([
      page.waitForURL('/dashboard/today', { timeout: 10000 }),
      page.getByTestId('onboarding-continue').click(),
    ]);
    await expect(page.getByTestId('welcome-message')).toBeVisible();

    await Promise.all([
      page.waitForURL('/dashboard/session', { timeout: 10000 }),
      page.getByTestId('session-link').click(),
    ]);
    await expect(page.locator('h1')).toHaveText('Entrenar');
    await expectCssColor(page.locator('main').first(), 'background-color', ATLAS_SMOKE.canvas);

    const [workoutResponse] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/workouts') && resp.status() === 201,
      ),
      page.waitForURL(/\/dashboard\/session\/\d+/, { timeout: 10000 }),
      page
        .getByTestId('routine-card')
        .filter({ hasText: 'Full body exprés' })
        .getByTestId('start-routine')
        .click(),
    ]);
    const { id: workoutId } = (await workoutResponse.json()) as { id: number };

    await expect(page.getByTestId('guided-exercise-name')).toHaveText('Press Banca');
    // Media lives behind the Técnica toggle so the set counter stays in focus by default.
    await page.getByRole('button', { name: 'Mostrar técnica' }).click();
    await expect(page.getByTestId('guided-exercise-image')).toBeVisible();
    await expect(page.getByTestId('session-skip')).toBeVisible();
    await expect(page.getByTestId('session-hold')).toBeVisible();

    await page.fill('[data-testid="guided-weight-input"]', '40');
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201),
      page.getByTestId('complete-set-button').click(),
    ]);

    await expect(page.getByTestId('rest-timer')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('rest-motivator')).toBeVisible();
    await page.click('[data-testid="skip-rest"]');

    await expect(page.getByTestId('next-exercise-banner')).toBeVisible();
    await expect(page.getByTestId('guided-exercise-name')).toHaveText('Sentadilla');

    await page.fill('[data-testid="guided-weight-input"]', '50');
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/next-exercise') && resp.status() === 200,
      ),
      page.getByTestId('complete-set-button').click(),
    ]);

    await expect(page.getByTestId('session-close')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('session-close')).toContainText('¡Sesión completada!');
    await expect(page.getByTestId('close-improvement').first()).toBeVisible();

    await page.click('[data-testid="close-effort-exigente"]');
    await page.click('[data-testid="close-mood-good"]');
    await expect(page.getByTestId('close-effort-exigente')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('close-mood-good')).toHaveAttribute('aria-pressed', 'true');
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().endsWith(`/api/workouts/${workoutId}/feedback`) &&
          resp.request().method() === 'POST' &&
          resp.status() === 200,
      ),
      page.waitForURL('/dashboard/today', { timeout: 10000 }),
      page.getByTestId('close-save').click(),
    ]);

    const activeAfter = await page.request.get('/api/workouts/active');
    expect(activeAfter.status()).toBe(200);
    expect(await activeAfter.json()).toBeNull();

    await Promise.all([
      page.waitForURL('/dashboard/progress', { timeout: 10000 }),
      page.getByTestId('progress-link').click(),
    ]);
    await expect(page.getByRole('heading', { name: 'Sesiones recientes' })).toBeVisible();
    await expect(page.locator('a[href^="/dashboard/workout/"]')).toBeVisible();
  });
});
