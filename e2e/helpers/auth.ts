import { expect, type Page } from '@playwright/test';

export async function persistOnboardingCompletionForCurrentUser(page: Page): Promise<void> {
  const response = await page.request.post('/api/profile/onboarding', {
    data: { action: 'skip' },
  });
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ completed: true });
}

export async function completeOnboardingForCurrentUser(page: Page): Promise<void> {
  await page.waitForURL('/onboarding', { timeout: 15000 });
  await persistOnboardingCompletionForCurrentUser(page);
  await page.goto('/dashboard/today');
  await expect(page.getByTestId('welcome-message')).toBeVisible({ timeout: 10000 });
}

export async function registerAndCompleteTestAccount(
  page: Page,
  name: string,
): Promise<void> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`;
  await page.goto('/register');
  await page.fill('input[type="text"]', name);
  await page.fill('input[type="email"]', email);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('Test1234!');
  await passwordInputs.nth(1).fill('Test1234!');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/register') && response.status() === 201,
    ),
    page.getByRole('button', { name: 'Crear cuenta' }).click(),
  ]);
  await completeOnboardingForCurrentUser(page);
}
