import { test, expect } from '@playwright/test';
import { ATLAS_SMOKE, expectCssColor } from './tailwind-smoke';

test.describe('Design system visual smoke', () => {
  test('home shell + brand CTA (tokens, lab() tolerant)', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      '#contenido',
    );

    const login = page.getByTestId('home-login-cta');
    await expect(login).toBeVisible();
    await expectCssColor(login, 'background-color', ATLAS_SMOKE.brand);
    await expect(login).toHaveCSS('border-radius', ATLAS_SMOKE.roundedMd);
    await expectCssColor(login, 'color', ATLAS_SMOKE.brandForeground);
  });

  test('login page uses canvas shell and token radius on submit', async ({ page }) => {
    await page.goto('/login');

    const main = page.locator('main');
    await expectCssColor(main, 'background-color', ATLAS_SMOKE.canvas);
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();

    const submit = page.locator('button[type="submit"]');
    await expect(submit).toHaveCSS('border-radius', ATLAS_SMOKE.roundedMd);
    await expectCssColor(submit, 'background-color', ATLAS_SMOKE.brand);
  });

  test('dashboard and settings share app shell nav', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'qa@atlas.test');
    await page.fill('input[type="password"]', 'Test1234!');
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/auth/login') && resp.status() === 200,
        { timeout: 10000 },
      ),
      page.waitForURL('/dashboard/today', { timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.getByTestId('welcome-message')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
    await expectCssColor(page.locator('main').first(), 'background-color', ATLAS_SMOKE.canvas);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCSS(
      'border-radius',
      ATLAS_SMOKE.roundedMd,
    );

    await Promise.all([
      page.waitForURL('**/dashboard/settings', { timeout: 10000 }),
      page.getByTestId('profile-link').click(),
    ]);
    await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expectCssColor(page.locator('main').first(), 'background-color', ATLAS_SMOKE.canvas);
  });
});
