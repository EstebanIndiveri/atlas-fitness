import { test, expect } from '@playwright/test';
import { expectCssColor, ATLAS_SMOKE } from './tailwind-smoke';

test.describe('Guided session (Epic-E Must)', () => {
  test.beforeEach(async ({ page }) => {
    const testUser = {
      name: 'Guided E2E',
      email: `guided-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`,
      password: 'Test1234!',
    };

    await page.goto('/register');
    await page.fill('input[type="text"]', testUser.name);
    await page.fill('input[type="email"]', testUser.email);
    const passwordInputs = await page.locator('input[type="password"]').all();
    await passwordInputs[0].fill(testUser.password);
    await passwordInputs[1].fill(testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/register') && resp.status() === 201);
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/me'));
  });

  test('GET /api/routines returns seeded routines and active is 200+null', async ({ page }) => {
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
    await page.click('[data-testid="guided-session-cta"]');
    await page.waitForURL('/dashboard/session', { timeout: 10000 });
    await expect(page.locator('h1')).toHaveText('Elegí una rutina');
    await expectCssColor(page.locator('main').first(), 'background-color', ATLAS_SMOKE.canvas);

    await page
      .getByTestId('routine-card')
      .filter({ hasText: 'Full body exprés' })
      .getByTestId('start-routine')
      .click();
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts') && resp.status() === 201);
    await page.waitForURL(/\/dashboard\/session\/\d+/, { timeout: 10000 });

    await expect(page.getByTestId('guided-exercise-name')).toHaveText('Press Banca');
    // Media region is always rendered (placeholder when catalog imageUrl is null).
    await expect(page.getByTestId('guided-exercise-image')).toBeVisible();
    await expect(page.getByTestId('session-skip')).toBeVisible();
    await expect(page.getByTestId('session-hold')).toBeVisible();

    await page.fill('[data-testid="guided-weight-input"]', '40');
    await page.click('[data-testid="complete-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201);

    await expect(page.getByTestId('rest-timer')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('rest-motivator')).toBeVisible();
    await page.click('[data-testid="skip-rest"]');

    await expect(page.getByTestId('next-exercise-banner')).toBeVisible();
    await expect(page.getByTestId('guided-exercise-name')).toHaveText('Sentadilla');

    await page.fill('[data-testid="guided-weight-input"]', '50');
    await page.click('[data-testid="complete-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/next-exercise') && resp.status() === 200);

    await expect(page.getByTestId('session-close')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('session-close')).toContainText('¡Sesión completada!');
    await expect(page.getByTestId('close-improvement').first()).toBeVisible();

    await page.click('[data-testid="close-mood-4"]');
    await page.click('[data-testid="close-save"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts/') && resp.status() === 200);

    await expect(page.getByTestId('close-streak')).toBeVisible({ timeout: 5000 });

    const activeAfter = await page.request.get('/api/workouts/active');
    expect(activeAfter.status()).toBe(200);
    expect(await activeAfter.json()).toBeNull();
  });
});
