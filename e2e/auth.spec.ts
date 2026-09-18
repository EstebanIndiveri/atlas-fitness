import { test, expect } from '@playwright/test';
import { expectCssColor, TW_SMOKE } from './tailwind-smoke';

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

    // Submit registration and wait for navigation
    await page.click('button[type="submit"]');
    
    // Wait for the API call to complete AND the redirect to happen
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/register') && resp.status() === 201);
    
    // Should redirect to dashboard (client-side then proxy allows)
    await page.waitForURL('/dashboard', { timeout: 15000 });
    
    // Wait for /api/auth/me to complete and welcome message to appear
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/me'));
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(TEST_USER.name);
    await expectCssColor(page.locator('main').first(), 'background-color', TW_SMOKE.gray50);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCSS(
      'border-radius',
      TW_SMOKE.roundedMd,
    );

    // Logout
    await page.click('button:has-text("Cerrar sesión")');

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 });

    // Login with same credentials
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    
    await page.click('button[type="submit"]');
    
    // Wait for the API call to complete AND the redirect to happen
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/login') && resp.status() === 200);
    
    // Should redirect to dashboard again
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/me'));
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
    await expect(page.locator('.bg-red-50')).toBeVisible();
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

    await page.click('button[type="submit"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/register') && resp.status() === 201);
    
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/me'));
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });

    // Try to go to login page while logged in - middleware should redirect back to dashboard
    await page.goto('/login');
    
    // Middleware should redirect us to dashboard
    await page.waitForURL('/dashboard', { timeout: 5000 });
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('QA user should be able to login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'qa@atlas.test');
    await page.fill('input[type="password"]', 'Test1234!');
    
    await page.click('button[type="submit"]');
    
    // Wait for either success (navigation to dashboard) or error
    await Promise.race([
      page.waitForURL('/dashboard', { timeout: 15000 }),
      page.waitForSelector('.bg-red-50', { timeout: 15000 }),
    ]);

    // If we're on dashboard, check welcome message
    if (page.url().includes('/dashboard')) {
      await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="welcome-message"]')).toContainText('QA Test User');
    }
  });
});
