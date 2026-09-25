import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/viewport';

async function registerFreshUser(page: import('@playwright/test').Page): Promise<void> {
  const testUser = {
    name: 'Hábito E2E',
    email: `habito-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`,
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
    page.waitForURL('/dashboard/today', { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

test.describe('UX hábito — mobile 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('app shell uses bottom tabs, streak chip, and golden-path workout entry', async ({ page }) => {
    await registerFreshUser(page);

    await expect(page.getByTestId('welcome-message')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('navigation', { name: 'Pestañas' })).toBeVisible();
    await expect(page.getByTestId('app-bottom-nav')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden();

    const homeTab = page.getByTestId('bottom-nav-today');
    const box = await homeTab.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await expect(page.getByTestId('streak-chip')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('current-streak')).toHaveText('0');
    await expect(page.getByTestId('longest-streak')).toHaveText('0');
    await expect(page.getByText('Todavía no tenés racha')).toBeVisible();

    await Promise.all([
      page.waitForURL('**/dashboard/session', { timeout: 10000 }),
      page.getByTestId('bottom-nav-session').click(),
    ]);
    await expect(page.getByRole('heading', { name: 'Entrenar' })).toBeVisible();
    await expect(page.getByTestId('start-routine').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('app-bottom-nav')).toBeVisible();
  });

  test('dedicated habits page fits the mobile viewport', async ({ page }) => {
    await registerFreshUser(page);
    await page.goto('/dashboard/habits');

    await expect(page.getByRole('heading', { name: 'Hábitos', level: 1 })).toBeVisible();
    const habitsList = page.getByTestId('habits-list');
    await expect(habitsList).toBeVisible();
    await expect(habitsList.getByRole('listitem')).toHaveCount(4);
    await expect(page.getByText('0 de 4 completados', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('UX hábito — desktop shell', () => {
  test('keeps header principal nav and hides bottom tabs', async ({ page }) => {
    await registerFreshUser(page);
    await expect(page.getByTestId('welcome-message')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
    await expect(page.getByTestId('profile-link')).toBeVisible();
    await expect(page.getByTestId('app-bottom-nav')).toBeHidden();
    await expect(page.getByTestId('streak-chip')).toBeVisible();
    await expect(page.getByTestId('current-streak')).toBeVisible();
  });
});
