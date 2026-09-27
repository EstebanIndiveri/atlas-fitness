import { test, expect } from '@playwright/test';
import { completeOnboardingForCurrentUser } from './helpers/auth';

async function registerFreshUser(page: import('@playwright/test').Page): Promise<void> {
  const testUser = {
    name: 'Rutinas E2E',
    email: `rutinas-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`,
    password: 'Test1234!',
  };

  await page.goto('/register');
  await page.fill('input[type="text"]', testUser.name);
  await page.fill('input[type="email"]', testUser.email);
  const passwordInputs = await page.locator('input[type="password"]').all();
  await passwordInputs[0].fill(testUser.password);
  await passwordInputs[1].fill(testUser.password);
  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/register') && resp.status() === 201,
    ),
    page.locator('button[type="submit"]').click(),
  ]);
  await completeOnboardingForCurrentUser(page);
}

test.describe('Routine editor (Must UI)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await registerFreshUser(page);
  });

  test('lists seeded routines and creates a custom routine', async ({ page }) => {
    await page.goto('/dashboard/routines');
    await expect(page.getByRole('heading', { name: 'Rutinas' })).toBeVisible();
    await expect(page.getByTestId('routine-editor-card').first()).toBeVisible();

    await Promise.all([
      page.waitForURL('**/dashboard/routines/new'),
      page.getByTestId('routine-create-cta').click(),
    ]);

    await page.getByTestId('routine-name-input').fill('Empuje casa');
    await page.getByTestId('routine-kind-home').check();
    const restInput = page.getByTestId('routine-rest-input');
    await expect(restInput).toHaveValue('90');
    await restInput.fill('');
    await expect(restInput).toHaveValue('');
    await restInput.fill('30');
    await expect(restInput).toHaveValue('30');

    const catalog = page.getByTestId('routine-exercise-catalog');
    await expect(catalog).toBeVisible();
    const optionValue = await catalog.locator('option').nth(1).getAttribute('value');
    expect(optionValue).toBeTruthy();
    await catalog.selectOption(optionValue!);
    await page.getByTestId('routine-add-exercise').click();

    await expect(page.getByTestId('routine-exercise-row')).toHaveCount(1);
    await expect(page.getByTestId('routine-exercise-media')).toBeVisible();
    await expect(page.getByTestId('routine-media-upload-image')).toBeDisabled();
    await expect(
      page.getByText(/no se puede cambiar/i).first(),
    ).toBeVisible();

    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/routines') &&
          resp.request().method() === 'POST' &&
          resp.status() === 201,
      ),
      page.waitForURL('**/dashboard/routines', { timeout: 10000 }),
      page.getByTestId('routine-save').click(),
    ]);
    await expect(page.getByTestId('routine-editor-card').filter({ hasText: 'Empuje casa' })).toBeVisible();
  });

  test('system routine is read-only', async ({ page }) => {
    await page.goto('/dashboard/routines');
    await Promise.all([
      page.waitForURL(/\/dashboard\/routines\/\d+\/edit/),
      page
        .getByTestId('routine-editor-card')
        .filter({ hasText: 'Full body exprés' })
        .getByRole('link', { name: 'Ver' })
        .click(),
    ]);
    await expect(page.getByTestId('routine-readonly-banner')).toBeVisible();
    await expect(page.getByTestId('routine-save')).toBeDisabled();
    await expect(page.getByTestId('routine-name-input')).toBeDisabled();
  });

  test('unknown routine id shows not-found without leaking other users', async ({ page }) => {
    await page.goto('/dashboard/routines/999999/edit');
    await expect(page.getByTestId('routine-not-found')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rutina no encontrada' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('userId');
  });
});
