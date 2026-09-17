import { test, expect } from '@playwright/test';
import { PWA_COPY } from '../lib/pwa/copy';
import { PWA_THEME } from '../lib/pwa/theme';

const TEST_USER = {
  email: 'qa@atlas.test',
  password: 'Test1234!',
};

test.describe('PWA installability', () => {
  test('links the web manifest and exposes installability fields', async ({ page, request }) => {
    await page.goto('/');

    // Next metadata.manifest plus the explicit <link> in layout (Must: both).
    const manifestLinks = page.locator('link[rel="manifest"]');
    await expect(manifestLinks.first()).toHaveAttribute('href', '/manifest.webmanifest');
    expect(await manifestLinks.count()).toBeGreaterThanOrEqual(1);

    const themeColor = page.locator('meta[name="theme-color"]').first();
    await expect(themeColor).toHaveAttribute('content', PWA_THEME.themeColor);

    const manifestResponse = await request.get('/manifest.webmanifest');
    expect(manifestResponse.ok()).toBe(true);
    const manifest = (await manifestResponse.json()) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };

    expect(manifest.name).toBe('Atlas Fitness');
    expect(manifest.short_name).toBe('Atlas');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe(PWA_THEME.themeColor);
    expect(manifest.background_color).toBe(PWA_THEME.backgroundColor);

    const icons = manifest.icons;
    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        }),
        expect.objectContaining({
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        }),
        expect.objectContaining({
          src: '/icon-192-maskable.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        }),
        expect.objectContaining({
          src: '/icon-512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }),
      ])
    );

    for (const icon of icons) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.status()).toBe(200);
      expect(iconResponse.headers()['content-type']).toMatch(/image\/png/);
    }
  });

  test('shows iOS Agregar a Inicio copy on Home', async ({ page }) => {
    await page.goto('/');
    const hint = page.getByTestId('ios-install-hint');
    await expect(hint).toBeVisible();
    await expect(hint.getByRole('heading', { name: PWA_COPY.iosTitle })).toBeVisible();
    await expect(hint).toContainText('Home Screen');
    await expect(hint).toContainText('Agregar a Inicio');
  });

  test('shows iOS Agregar a Inicio copy on Settings', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/auth/login') && resp.status() === 200,
        { timeout: 10000 }
      ),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForURL('/dashboard', { timeout: 20000 });
    await page.click('[data-testid="settings-link"]');
    await page.waitForURL('**/dashboard/settings', { timeout: 10000 });

    const settingsHint = page.getByTestId('pwa-install-settings').getByTestId('ios-install-hint');
    await expect(settingsHint).toBeVisible();
    await expect(settingsHint).toContainText(PWA_COPY.iosTitle);
    await expect(settingsHint).toContainText('Home Screen');
  });

  test('serves the service worker with scope headers and does not cache API', async ({
    request,
  }) => {
    const sw = await request.get('/sw.js');
    expect(sw.ok()).toBe(true);
    expect(sw.headers()['content-type']).toMatch(/javascript/);
    expect(sw.headers()['service-worker-allowed']).toBe('/');
    const body = await sw.text();
    expect(body).toContain("pathname.startsWith('/api/')");
    expect(body).not.toMatch(/addEventListener\(\s*['"]sync['"]/);
  });

  /**
   * SKIP: Chrome does not fire `beforeinstallprompt` in headless Playwright CI.
   * Chromium's installability heuristic (user engagement + HTTPS + installable
   * manifest) is not met by `playwright test` against localhost.
   *
   * Verify locally (not CI):
   * 1. `npm run build && npm start` (or HTTPS `next dev --experimental-https`)
   * 2. Chrome desktop → DevTools → Application → Manifest → install / "Add to homescreen"
   * 3. Android Chrome on a deployed HTTPS URL — the Instalar banner should appear
   * 4. iOS Safari — no banner; use Agregar a Inicio copy on Home and Settings
   */
  test.skip('install banner via beforeinstallprompt (not available in headless CI)', async () => {
    // Intentionally skipped — see comment above.
  });
});
