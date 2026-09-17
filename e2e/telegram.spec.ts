import { test, expect } from '@playwright/test';

function registerUser() {
  return {
    name: 'Telegram E2E',
    email: `tg-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
    password: 'Test1234!',
  };
}

async function registerAndLandOnDashboard(page: import('@playwright/test').Page) {
  const user = registerUser();
  await page.goto('/register');
  await page.fill('input[type="text"]', user.name);
  await page.fill('input[type="email"]', user.email);
  const passwordInputs = await page.locator('input[type="password"]').all();
  await passwordInputs[0].fill(user.password);
  await passwordInputs[1].fill(user.password);
  await page.click('button[type="submit"]');
  await page.waitForResponse(
    (resp) => resp.url().includes('/api/auth/register') && resp.status() === 201
  );
  await page.waitForURL('/dashboard', { timeout: 15000 });
  await page.waitForResponse((resp) => resp.url().includes('/api/auth/me'));
  await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
  return user;
}

test.describe('Telegram link + webhook', () => {
  test('settings link-code flow and home banner when unlinked', async ({ page }) => {
    await registerAndLandOnDashboard(page);

    await expect(page.getByTestId('telegram-link-banner')).toBeVisible();
    await expect(page.getByTestId('telegram-link-banner')).toContainText('Vinculá Telegram');

    await page.getByTestId('telegram-link-banner-cta').click();
    await page.waitForURL('**/dashboard/settings', { timeout: 10000 });
    await expect(page.getByTestId('telegram-unlinked-status')).toBeVisible();

    const codeResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/telegram/link-code') && resp.status() === 200
    );
    await page.getByTestId('generate-link-code').click();
    const generated = await codeResponse;
    const body = await generated.json();
    expect(body.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    await expect(page.getByTestId('telegram-link-code')).toHaveText(body.code);
    await expect(page.getByTestId('telegram-link-code-expiry')).toBeVisible();
  });

  test('webhook is idempotent with stubbed Telegram (no outbound network)', async ({
    page,
    request,
  }) => {
    await registerAndLandOnDashboard(page);

    const codeRes = await page.request.post('/api/auth/telegram/link-code');
    expect(codeRes.status()).toBe(200);
    const { code } = (await codeRes.json()) as { code: string };
    expect(code).toBeTruthy();

    const telegramUserId = 88000 + Math.floor(Math.random() * 10000);
    const updateId = Date.now() + Math.floor(Math.random() * 1000);
    const update = {
      update_id: updateId,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        text: code,
        from: { id: telegramUserId, is_bot: false, first_name: 'Tito' },
        chat: { id: telegramUserId, type: 'private' },
      },
    };

    const first = await request.post('/api/telegram/webhook', { data: update });
    const second = await request.post('/api/telegram/webhook', { data: update });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.ok).toBe(true);
    expect(firstBody.duplicate).toBe(false);
    expect(secondBody.duplicate).toBe(true);

    const me = await page.request.get('/api/auth/me');
    const meBody = await me.json();
    expect(meBody.telegramUserId).toBe(String(telegramUserId));

    await page.goto('/dashboard');
    await expect(page.getByTestId('telegram-link-banner')).toHaveCount(0);

    const logId = updateId + 1;
    const logUpdate = {
      update_id: logId,
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        text: '/log press banca 80.5 10',
        from: { id: telegramUserId, is_bot: false, first_name: 'Tito' },
        chat: { id: telegramUserId, type: 'private' },
      },
    };

    const logFirst = await request.post('/api/telegram/webhook', { data: logUpdate });
    const logSecond = await request.post('/api/telegram/webhook', { data: logUpdate });
    expect(logFirst.status()).toBe(200);
    expect(logSecond.status()).toBe(200);
    expect((await logSecond.json()).duplicate).toBe(true);

    const workoutsRes = await page.request.get('/api/workouts/active');
    expect(workoutsRes.status()).toBe(200);
    const active = await workoutsRes.json();
    expect(active).not.toBeNull();

    const setsRes = await page.request.get(`/api/workouts/${active.id}/sets`);
    expect(setsRes.status()).toBe(200);
    const sets = (await setsRes.json()) as Array<{ weightKg: string; reps: number }>;
    expect(sets).toHaveLength(1);
    expect(sets[0].weightKg).toBe('80.5');
    expect(sets[0].reps).toBe(10);
  });
});
