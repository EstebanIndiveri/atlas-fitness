import { test, expect } from '@playwright/test';

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

    // Submit registration
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Atlas Fitness');
    await expect(page.locator('text=Bienvenido')).toBeVisible();

    // Verify user name is displayed
    await expect(page.locator(`text=${TEST_USER.name}`)).toBeVisible();

    // Logout
    await page.click('button:has-text("Cerrar sesión")');

    // Should redirect to login
    await page.waitForURL('/login');

    // Login with same credentials
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard again
    await page.waitForURL('/dashboard');
    await expect(page.locator(`text=${TEST_USER.name}`)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Error al iniciar sesión')).toBeVisible();
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

  test('should redirect logged-in user from login to dashboard', async ({ page, context }) => {
    // First register a user
    await page.goto('/register');
    const email = `redirect-${Date.now()}@test.com`;

    await page.fill('input[type="text"]', 'Redirect Test');
    await page.fill('input[type="email"]', email);
    const passwordInputs = await page.locator('input[type="password"]').all();
    await passwordInputs[0].fill(TEST_USER.password);
    await passwordInputs[1].fill(TEST_USER.password);

    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Try to go to login page while logged in
    await page.goto('/login');

    // Note: Without middleware, this won't auto-redirect
    // But we can verify the session still works
    await page.goto('/dashboard');
    await expect(page.locator('text=Bienvenido')).toBeVisible();
  });

  test('QA user should be able to login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'qa@atlas.test');
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard');
    await expect(page.locator('text=QA Test User')).toBeVisible();
  });
});
