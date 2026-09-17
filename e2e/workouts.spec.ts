import { test, expect } from '@playwright/test';

const TEST_USER = {
  name: 'Workout E2E Test',
  email: `workout-e2e-${Date.now()}@test.com`,
  password: 'Test1234!',
};

test.describe('Workout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Register and login
    await page.goto('/register');
    await page.fill('input[type="text"]', TEST_USER.name);
    await page.fill('input[type="email"]', TEST_USER.email);
    const passwordInputs = await page.locator('input[type="password"]').all();
    await passwordInputs[0].fill(TEST_USER.password);
    await passwordInputs[1].fill(TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/register') && resp.status() === 201);
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/me'));
  });

  test('should create workout → add set → edit set → delete set → close workout', async ({ page }) => {
    // Start new workout
    await page.click('[data-testid="new-workout-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts') && resp.status() === 201);
    
    // Should be on workout session page
    await expect(page.locator('h1:has-text("Sesión Activa")')).toBeVisible({ timeout: 10000 });

    // Add a set
    await page.click('[data-testid="add-set-button"]');
    await page.waitForSelector('[data-testid="exercise-select"]');
    
    // Select exercise (assuming Press Banca exists from seed)
    await page.selectOption('[data-testid="exercise-select"]', { index: 1 });
    await page.fill('[data-testid="reps-input"]', '10');
    await page.fill('[data-testid="weight-input"]', '100');
    
    await page.click('[data-testid="save-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201);

    // Verify set is displayed
    await expect(page.locator('[data-testid="workout-set"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="workout-set"]')).toContainText('10 reps');
    await expect(page.locator('[data-testid="workout-set"]')).toContainText('100');

    // Edit the set
    await page.click('[data-testid="workout-set"] button:has-text("Editar")');
    await page.waitForSelector('[data-testid="weight-input"]');
    await page.fill('[data-testid="weight-input"]', '105');
    await page.click('[data-testid="save-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/sets/') && resp.status() === 200);

    // Verify edit
    await expect(page.locator('[data-testid="workout-set"]')).toContainText('105');

    // Add another set to test PR badge
    await page.click('[data-testid="add-set-button"]');
    await page.selectOption('[data-testid="exercise-select"]', { index: 1 });
    await page.fill('[data-testid="reps-input"]', '8');
    await page.fill('[data-testid="weight-input"]', '110');
    await page.click('[data-testid="save-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201);

    // Verify PR badge appears (should be PR since it's the first workout)
    await expect(page.locator('[data-testid="pr-badge"]').first()).toBeVisible({ timeout: 5000 });

    // Delete the first set
    const firstSetDeleteButton = await page.locator('[data-testid="workout-set"] button:has-text("Eliminar")').first();
    await firstSetDeleteButton.click();
    page.on('dialog', dialog => dialog.accept());
    await page.waitForResponse((resp) => resp.url().includes('/sets/') && resp.status() === 200);

    // Should only have one set now
    await expect(page.locator('[data-testid="workout-set"]')).toHaveCount(1);

    // Close workout
    await page.click('button:has-text("Finalizar")');
    await page.waitForSelector('h2:has-text("Finalizar Entrenamiento")');
    
    // Add note and mood
    await page.fill('textarea', 'Buen entrenamiento inicial');
    await page.click('button:has-text("😊")'); // Mood 4
    
    await page.click('[data-testid="confirm-end-workout"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts/') && resp.status() === 200);

    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify workout appears in history
    await expect(page.locator('text=Buen entrenamiento inicial')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=😊')).toBeVisible();
  });

  test('should show PR badge when matching or exceeding previous record', async ({ page }) => {
    // Create first workout
    await page.click('[data-testid="new-workout-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts') && resp.status() === 201);
    
    // Add a set with weight 100kg
    await page.click('[data-testid="add-set-button"]');
    await page.selectOption('[data-testid="exercise-select"]', { index: 1 });
    await page.fill('[data-testid="reps-input"]', '10');
    await page.fill('[data-testid="weight-input"]', '100');
    await page.click('[data-testid="save-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201);

    // Close first workout
    await page.click('button:has-text("Finalizar")');
    await page.waitForSelector('h2:has-text("Finalizar Entrenamiento")');
    await page.click('[data-testid="confirm-end-workout"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts/') && resp.status() === 200);
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Create second workout
    await page.click('[data-testid="new-workout-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts') && resp.status() === 201);

    // Add set with lower weight - should NOT show PR badge
    await page.click('[data-testid="add-set-button"]');
    await page.selectOption('[data-testid="exercise-select"]', { index: 1 });
    await page.fill('[data-testid="reps-input"]', '10');
    await page.fill('[data-testid="weight-input"]', '95');
    await page.click('[data-testid="save-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201);

    // Should NOT have PR badge
    await expect(page.locator('[data-testid="pr-badge"]')).toHaveCount(0);

    // Add set with higher weight - should show PR badge
    await page.click('[data-testid="add-set-button"]');
    await page.selectOption('[data-testid="exercise-select"]', { index: 1 });
    await page.fill('[data-testid="reps-input"]', '8');
    await page.fill('[data-testid="weight-input"]', '105');
    await page.click('[data-testid="save-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201);

    // Should have PR badge on the second set
    await expect(page.locator('[data-testid="pr-badge"]')).toHaveCount(1);
  });

  test('should display workout history', async ({ page }) => {
    // Create a workout
    await page.click('[data-testid="new-workout-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts') && resp.status() === 201);
    
    await page.click('[data-testid="add-set-button"]');
    await page.selectOption('[data-testid="exercise-select"]', { index: 1 });
    await page.fill('[data-testid="reps-input"]', '10');
    await page.fill('[data-testid="weight-input"]', '100');
    await page.click('[data-testid="save-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201);

    await page.click('button:has-text("Finalizar")');
    await page.waitForSelector('h2:has-text("Finalizar Entrenamiento")');
    await page.fill('textarea', 'Test workout');
    await page.click('[data-testid="confirm-end-workout"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts/') && resp.status() === 200);
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Go to history page
    await page.click('a:has-text("Ver todo")');
    await page.waitForURL('/dashboard/history', { timeout: 5000 });

    // Verify workout is in history
    await expect(page.locator('[data-testid="workout-history-item"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Test workout')).toBeVisible();
  });

  test('should show active workout on dashboard when not finished', async ({ page }) => {
    // Create a workout
    await page.click('[data-testid="new-workout-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts') && resp.status() === 201);
    
    // Go back to dashboard without finishing
    await page.click('a:has-text("Volver")');
    await page.waitForURL('/dashboard', { timeout: 5000 });

    // Should see active workout banner
    await expect(page.locator('text=Entrenamiento Activo')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('a:has-text("Continuar Entrenamiento")')).toBeVisible();

    // Should NOT see new workout button
    await expect(page.locator('[data-testid="new-workout-button"]')).not.toBeVisible();
  });

  test('should not allow adding sets to finished workout', async ({ page }) => {
    // Create and finish a workout
    await page.click('[data-testid="new-workout-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts') && resp.status() === 201);
    
    await page.click('[data-testid="add-set-button"]');
    await page.selectOption('[data-testid="exercise-select"]', { index: 1 });
    await page.fill('[data-testid="reps-input"]', '10');
    await page.fill('[data-testid="weight-input"]', '100');
    await page.click('[data-testid="save-set-button"]');
    await page.waitForResponse((resp) => resp.url().includes('/sets') && resp.status() === 201);

    await page.click('button:has-text("Finalizar")');
    await page.waitForSelector('h2:has-text("Finalizar Entrenamiento")');
    await page.click('[data-testid="confirm-end-workout"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/workouts/') && resp.status() === 200);
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Click on the workout in history
    const workoutLink = page.locator('a[href^="/dashboard/workout/"]').first();
    await workoutLink.click();
    await page.waitForURL(/\/dashboard\/workout\/\d+/, { timeout: 5000 });

    // Should show "Entrenamiento Finalizado"
    await expect(page.locator('h1:has-text("Entrenamiento Finalizado")')).toBeVisible();

    // Should NOT show add set button
    await expect(page.locator('[data-testid="add-set-button"]')).not.toBeVisible();

    // Should NOT show finalize button
    await expect(page.locator('button:has-text("Finalizar")')).not.toBeVisible();
  });
});
