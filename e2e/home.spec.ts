import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads with a 200 status
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('should display Atlas Fitness title', async ({ page }) => {
    await page.goto('/');

    // Check for the main title
    const title = page.locator('h1');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('Atlas Fitness');
  });

  test('should display placeholder content', async ({ page }) => {
    await page.goto('/');

    // Check for placeholder text indicating this is phase 1 scaffold
    await expect(page.locator('text=Asistente de fitness personal')).toBeVisible();
  });
});
