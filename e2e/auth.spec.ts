import { test, expect } from '@playwright/test';
import { expectCssColor, ATLAS_SMOKE } from './tailwind-smoke';
import {
  completeOnboardingForCurrentUser,
  persistOnboardingCompletionForCurrentUser,
} from './helpers/auth';

const TEST_USER = {
  name: 'E2E Test User',
  email: `e2e-${Date.now()}@test.com`,
  password: 'Test1234!',
};

test.describe('Authentication Flow', () => {
  test('should complete full auth flow: register → login → me → logout', async ({ page }) => {
    // Go to register page
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText('Atlas Fitness');

    // Fill registration form
    await page.fill('input[type="text"]', TEST_USER.name);
    await page.fill('input[type="email"]', TEST_USER.email);
    const passwordInputs = await page.locator('input[type="password"]').all();
    await passwordInputs[0].fill(TEST_USER.password);
    await passwordInputs[1].fill(TEST_USER.password);

    // Observe registration before submitting so a fast response cannot be missed.
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/auth/register') && resp.status() === 201,
      ),
      page.getByRole('button', { name: 'Crear cuenta' }).click(),
    ]);
    await completeOnboardingForCurrentUser(page);

    // The welcome state is the user-visible confirmation that auth hydration completed.
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(TEST_USER.name);
    await expectCssColor(page.locator('main').first(), 'background-color', ATLAS_SMOKE.canvas);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCSS(
      'border-radius',
      ATLAS_SMOKE.roundedMd,
    );

    // Logout
    await Promise.all([
      page.waitForURL('/login', { timeout: 5000 }),
      page.getByRole('button', { name: 'Cerrar sesión' }).click(),
    ]);

    // Login with same credentials
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/auth/login') && resp.status() === 200,
      ),
      page.waitForURL('/dashboard/today', { timeout: 15000 }),
      page.getByRole('button', { name: 'Ingresar' }).click(),
    ]);
    
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(TEST_USER.name);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Should show error message (from backend in es-AR)
    await expect(page.locator('text=Email o contraseña inválidos')).toBeVisible();
  });

  test('should show error for weak password on registration', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', `weak-${Date.now()}@test.com`);
    const passwordInputs = await page.locator('input[type="password"]').all();
    await passwordInputs[0].fill('weak');
    await passwordInputs[1].fill('weak');

    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.getByTestId('form-error')).toBeVisible();
  });

  test('should redirect logged-in user from login to dashboard', async ({ page }) => {
    // First register a user
    await page.goto('/register');
    const email = `redirect-${Date.now()}@test.com`;

    await page.fill('input[type="text"]', 'Redirect Test');
    await page.fill('input[type="email"]', email);
    const passwordInputs = await page.locator('input[type="password"]').all();
    await passwordInputs[0].fill(TEST_USER.password);
    await passwordInputs[1].fill(TEST_USER.password);

    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/auth/register') && resp.status() === 201,
      ),
      page.getByRole('button', { name: 'Crear cuenta' }).click(),
    ]);
    await completeOnboardingForCurrentUser(page);
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });

    // Try to go to login page while logged in - middleware should redirect back to dashboard
    await page.goto('/login');
    
    // Middleware should redirect us to dashboard
    await page.waitForURL('/dashboard/today', { timeout: 5000 });
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('QA user should be able to login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'qa@atlas.test');
    await page.fill('input[type="password"]', 'Test1234!');
    
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/auth/login') && resp.status() === 200,
      ),
      page.getByRole('button', { name: 'Ingresar' }).click(),
    ]);

    await page.waitForURL(
      (url) => url.pathname === '/onboarding' || url.pathname === '/dashboard/today',
      { timeout: 15000 },
    );
    await persistOnboardingCompletionForCurrentUser(page);
    await page.goto('/dashboard/today');
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('QA Test User');

    const currentUser = await page.request.get('/api/auth/me');
    expect(currentUser.status()).toBe(200);
    await expect(currentUser.json()).resolves.toMatchObject({ id: expect.any(Number) });
  });
});
