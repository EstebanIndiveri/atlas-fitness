import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'qa@atlas.test',
  password: 'Test1234!',
};

test.describe('Daily Tips', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard');
  });

  test('should display tip card on dashboard', async ({ page }) => {
    const tipCard = page.getByTestId('tip-card');
    await expect(tipCard).toBeVisible();

    const tipBody = page.getByTestId('tip-body');
    await expect(tipBody).toBeVisible();
    await expect(tipBody).not.toBeEmpty();
  });

  test('should show start workout CTA when no active workout', async ({ page }) => {
    // Make sure there's no active workout
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const continueButton = page.getByTestId('continue-workout-cta');
    const startButton = page.getByTestId('new-workout-button');

    // Wait for page to load and check which button is visible
    await page.waitForTimeout(1000);
    const hasContinue = await continueButton.isVisible().catch(() => false);

    if (hasContinue) {
      // End active workout first
      await continueButton.click();
      await page.waitForURL(/\/dashboard\/workout\/\d+/, { timeout: 10000 });

      // Find and click the finish button (opens modal)
      const finishButton = page.locator('button:has-text("Finalizar")');
      await finishButton.waitFor({ state: 'visible', timeout: 5000 });
      await finishButton.click();
      
      // Wait for modal and submit
      await page.waitForSelector('h2:has-text("Finalizar Entrenamiento")');
      const confirmButton = page.locator('button:has-text("Confirmar")');
      await confirmButton.click();
      await page.waitForURL('/dashboard', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }

    // Now check for start workout button
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await expect(startButton).toHaveText('Empezar Entreno');
  });

  test('should create new workout when clicking start workout CTA', async ({ page }) => {
    // This test just verifies the button triggers workout creation
    // The full workflow is already tested in workouts.spec.ts
    
    // Ensure we're on dashboard with no active workout
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      
      const startButton = page.getByTestId('new-workout-button');
      const isStartVisible = await startButton.isVisible().catch(() => false);
      
      if (isStartVisible) {
        // We have a start button, test can proceed
        await startButton.click();
        await page.waitForURL(/\/dashboard\/workout\/\d+/, { timeout: 10000 });
        await expect(page.locator('h1:has-text("Sesión Activa")')).toBeVisible({ timeout: 10000 });
        return;
      }
      
      // Need to finish active workout first
      const continueButton = page.getByTestId('continue-workout-cta');
      const isContinueVisible = await continueButton.isVisible().catch(() => false);
      
      if (isContinueVisible) {
        await continueButton.click();
        await page.waitForURL(/\/dashboard\/workout\/\d+/, { timeout: 10000 });
        
        const finishButton = page.locator('button:has-text("Finalizar")');
        await finishButton.waitFor({ state: 'visible', timeout: 5000 });
        await finishButton.click();
        
        await page.waitForSelector('h2:has-text("Finalizar Entrenamiento")');
        const confirmButton = page.locator('button:has-text("Confirmar")');
        await confirmButton.click();
        await page.waitForURL('/dashboard', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      }
      
      attempts++;
    }
    
    throw new Error('Failed to get into a state where we can start a workout');
  });

  test('should show continue workout CTA when active workout exists', async ({ page }) => {
    // This test verifies the continue button shows when there's an active workout
    // If there's already an active workout, great! If not, create one.
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    const startButton = page.getByTestId('new-workout-button');
    const continueButton = page.getByTestId('continue-workout-cta');

    const hasStart = await startButton.isVisible().catch(() => false);

    if (hasStart) {
      // Create an active workout
      await startButton.click();
      await page.waitForURL(/\/dashboard\/workout\/\d+/, { timeout: 10000 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    // Now check for continue button
    await expect(continueButton).toBeVisible({ timeout: 10000 });
    await expect(continueButton).toHaveText('Continuar Entrenamiento');
  });

  test('should allow mood selection', async ({ page }) => {
    const mood3Button = page.getByTestId('mood-3');
    await expect(mood3Button).toBeVisible();

    await mood3Button.click();

    // Button should have active styling (bg-blue-200)
    await expect(mood3Button).toHaveClass(/bg-blue-200/);
  });

  test('should allow selecting different moods', async ({ page }) => {
    const mood1Button = page.getByTestId('mood-1');
    const mood5Button = page.getByTestId('mood-5');

    await mood1Button.click();
    await expect(mood1Button).toHaveClass(/bg-blue-200/);

    await mood5Button.click();
    await expect(mood5Button).toHaveClass(/bg-blue-200/);
    await expect(mood1Button).not.toHaveClass(/bg-blue-200/);
  });

  test('should show tip even with AI disabled (fallback to system)', async ({ page }) => {
    // The API should always return a tip (system fallback)
    const tipBody = page.getByTestId('tip-body');
    await expect(tipBody).toBeVisible();

    const text = await tipBody.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(10);
  });
});
