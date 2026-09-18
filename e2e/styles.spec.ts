import { test, expect } from '@playwright/test';
import { expectCssColor, TW_SMOKE } from './tailwind-smoke';

test.describe('Tailwind utilities apply', () => {
  test('home login CTA is styled (bg-slate-900, rounded-md)', async ({ page }) => {
    await page.goto('/');

    const login = page.getByRole('link', { name: 'Iniciar sesión' });
    await expect(login).toBeVisible();
    await expectCssColor(login, 'background-color', TW_SMOKE.slate900);
    await expect(login).toHaveCSS('border-radius', TW_SMOKE.roundedMd);
    await expectCssColor(login, 'color', TW_SMOKE.white);
  });

  test('login page uses gray background and rounded controls', async ({ page }) => {
    await page.goto('/login');

    const main = page.locator('main');
    await expectCssColor(main, 'background-color', TW_SMOKE.gray50);

    const submit = page.locator('button[type="submit"]');
    await expect(submit).toHaveCSS('border-radius', TW_SMOKE.roundedMd);
  });
});
