import { test, expect } from '@playwright/test';
import { expectCssColor, ATLAS_SMOKE } from './tailwind-smoke';

/**
 * Starts a manual ad-hoc workout via the API and opens its logger page.
 * Replaces the removed legacy dashboard "new workout" CTA.
 */
async function startManualWorkout(page: import('@playwright/test').Page): Promise<number> {
  const res = await page.request.post('/api/workouts');
  if (res.status() !== 201) {
    throw new Error(`Expected 201 creating workout, got ${res.status()}`);
  }
  const created = (await res.json()) as { id: number };
  await page.goto(`/dashboard/workout/${created.id}`);
  return created.id;
}

test.describe('Workout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Generate unique email for each test run
    const testUser = {
      name: 'Workout E2E Test',
      email: `workout-e2e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`,
      password: 'Test1234!',
    };

    // Register and login
    await page.goto('/register');
    await page.fill('input[type="text"]', testUser.name);
    await page.fill('input[type="email"]', testUser.email);
    const passwordInputs = await page.locator('input[type="password"]').all();
    await passwordInputs[0].fill(testUser.password);
    await passwordInputs[1].fill(testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/register') && resp.status() === 201);
    await page.waitForURL('/dashboard/today', { timeout: 15000 });
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/me'));
  });

  test('GET /api/workouts/active returns 200 with null when none is active', async ({ page }) => {
    const response = await page.request.get('/api/workouts/active');
    expect(response.status()).toBe(200);
    expect(await response.json()).toBeNull();
  });

  test('GET /api/workouts/active returns 200 with workout JSON when one exists', async ({ page }) => {
    const createRes = await page.request.post('/api/workouts');
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { id: number };

    const response = await page.request.get('/api/workouts/active');
    expect(response.status()).toBe(200);
    const active = (await response.json()) as { id: number; endedAt: string | null };
    expect(active).not.toBeNull();
    expect(active.id).toBe(created.id);
    expect(active.endedAt).toBeNull();
  });

  test('should create workout → add set → edit set → delete set → close workout', async ({ page }) => {
    // Start new workout
    await startManualWorkout(page);
    
    // Should be on workout session page
    await expect(page.locator('h1:has-text("Sesión Activa")')).toBeVisible({ timeout: 10000 });
    await expectCssColor(page.locator('main').first(), 'background-color', ATLAS_SMOKE.canvas);
    await expect(page.locator('[data-testid="add-set-button"]')).toHaveCSS(
      'border-radius',
      ATLAS_SMOKE.roundedMd,
    );

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
    // Set up dialog handler BEFORE clicking
    page.once('dialog', dialog => dialog.accept());
    const firstSetDeleteButton = await page.locator('[data-testid="workout-set"] button:has-text("Eliminar")').first();
    await firstSetDeleteButton.click();
    await page.waitForResponse((resp) => resp.url().includes('/sets/') && (resp.status() === 200 || resp.status() === 204));

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

    // Should redirect to the Today home
    await page.waitForURL('/dashboard/today', { timeout: 10000 });

    // The note and mood persisted (surfaced via the API; HOY does not list history).
    const list = await page.request.get('/api/workouts');
    expect(list.status()).toBe(200);
    const workouts = (await list.json()) as Array<{ note: string | null; mood: number | null }>;
    expect(
      workouts.some((w) => w.note === 'Buen entrenamiento inicial' && w.mood === 4),
    ).toBe(true);
  });

  test('should show PR badge when matching or exceeding previous record', async ({ page }) => {
    // Create first workout
    await startManualWorkout(page);
    
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
    await page.waitForURL('/dashboard/today', { timeout: 10000 });

    // Create second workout
    await startManualWorkout(page);

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

  test('should display workout progress recent sessions', async ({ page }) => {
    // Create a workout
    await startManualWorkout(page);
    
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
    await page.waitForURL('/dashboard/today', { timeout: 10000 });

    // Go to the Progreso (history) tab, which lists recent sessions.
    await page.goto('/dashboard/history');
    await page.waitForURL('/dashboard/history', { timeout: 5000 });

    // Verify the completed workout is represented in the progress recent sessions list.
    await expect(page.locator('h1:has-text("Progreso")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h2:has-text("Sesiones recientes")')).toBeVisible();
    await expect(page.locator('a[href^="/dashboard/workout/"]')).toBeVisible();
  });

  test('should expose active workout via API when not finished', async ({ page }) => {
    // Start a workout and leave it open (golden path: no legacy dashboard resume CTA).
    const workoutId = await startManualWorkout(page);

    // Go back to the Today home without finishing.
    await page.click('a:has-text("Volver")');
    await page.waitForURL('/dashboard/today', { timeout: 5000 });

    // The unfinished workout is still resumable through the API.
    const active = await page.request.get('/api/workouts/active');
    expect(active.status()).toBe(200);
    const body = (await active.json()) as { id: number; endedAt: string | null };
    expect(body.id).toBe(workoutId);
    expect(body.endedAt).toBeNull();
  });

  test('should not allow adding sets to finished workout', async ({ page }) => {
    // Create and finish a workout
    const workoutId = await startManualWorkout(page);
    
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
    await page.waitForURL('/dashboard/today', { timeout: 10000 });

    // Reopen the finished workout directly.
    await page.goto(`/dashboard/workout/${workoutId}`);
    await page.waitForURL(/\/dashboard\/workout\/\d+/, { timeout: 5000 });

    // Should show "Entrenamiento Finalizado"
    await expect(page.locator('h1:has-text("Entrenamiento Finalizado")')).toBeVisible();

    // Should NOT show add set button
    await expect(page.locator('[data-testid="add-set-button"]')).not.toBeVisible();

    // Should NOT show finalize button
    await expect(page.locator('button:has-text("Finalizar")')).not.toBeVisible();
  });
});
