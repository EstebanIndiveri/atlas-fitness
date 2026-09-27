import { test, expect } from '@playwright/test';
import { completeOnboardingForCurrentUser } from './helpers/auth';

const CRON_SECRET = process.env.CRON_SECRET || 'test-secret-for-e2e';
const NUDGE_CRON_URL = '/api/cron/streak-nudge';

function cordobaLocalDate(instant = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function addLocalDateDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = String(utc.getUTCFullYear()).padStart(4, '0');
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Noon in Córdoba (UTC−3, no DST) for a calendar date. */
function isoAtCordobaNoon(localDate: string): string {
  return new Date(`${localDate}T12:00:00.000-03:00`).toISOString();
}

async function registerFreshUser(page: import('@playwright/test').Page) {
  const testUser = {
    name: 'Streak E2E',
    email: `streak-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`,
    password: 'Test1234!',
  };

  await page.goto('/register');
  await page.fill('input[type="text"]', testUser.name);
  await page.fill('input[type="email"]', testUser.email);
  const passwordInputs = await page.locator('input[type="password"]').all();
  await passwordInputs[0].fill(testUser.password);
  await passwordInputs[1].fill(testUser.password);
  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/register') && resp.status() === 201,
    ),
    page.locator('button[type="submit"]').click(),
  ]);
  await completeOnboardingForCurrentUser(page);
  await expect(page.getByTestId('streak-chip')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('current-streak')).toBeVisible({ timeout: 10000 });
}

test.describe('Streaks + nudges', () => {
  test.describe.configure({ mode: 'serial' });

  test('streak increments when closing a workout', async ({ page }) => {
    await registerFreshUser(page);
    await expect(page.getByTestId('current-streak')).toHaveText('0');
    await expect(page.getByTestId('longest-streak')).toHaveText('0');

    // Complete a workout end-to-end via the API (golden path removed the legacy
    // dashboard "new workout" CTA; streak logic is what we assert here).
    const created = await page.request.post('/api/workouts');
    expect(created.status()).toBe(201);
    const workout = (await created.json()) as { id: number };
    const ended = await page.request.patch(`/api/workouts/${workout.id}`, {
      data: { endedAt: new Date().toISOString() },
    });
    expect(ended.status()).toBe(200);

    // The Today home reflects the updated streak after reloading.
    await page.goto('/dashboard/today');
    await expect(page.getByTestId('current-streak')).toHaveText('1', { timeout: 10000 });
    await expect(page.getByTestId('longest-streak')).toHaveText('1');
  });

  test('TZ Córdoba: no double-count same day (workout + mood)', async ({ page }) => {
    await registerFreshUser(page);

    const today = cordobaLocalDate();

    const created = await page.request.post('/api/workouts');
    expect(created.status()).toBe(201);
    const workout = await created.json();

    const ended = await page.request.patch(`/api/workouts/${workout.id}`, {
      data: { endedAt: new Date().toISOString() },
    });
    expect(ended.status()).toBe(200);

    const mood = await page.request.post('/api/mood', {
      data: { mood: 4 },
    });
    expect(mood.status()).toBe(200);

    const sameDay = await page.request.get('/api/stats/streak');
    expect(sameDay.status()).toBe(200);
    const sameDayBody = await sameDay.json();
    expect(sameDayBody.currentStreak).toBe(1);
    expect(sameDayBody.lastActiveDate).toBe(today);

    const second = await page.request.post('/api/workouts');
    const secondWorkout = await second.json();
    await page.request.patch(`/api/workouts/${secondWorkout.id}`, {
      data: { endedAt: new Date().toISOString() },
    });

    const stillOne = await page.request.get('/api/stats/streak');
    const stillOneBody = await stillOne.json();
    expect(stillOneBody.currentStreak).toBe(1);
    expect(stillOneBody.lastActiveDate).toBe(today);
  });

  test('TZ Córdoba: activity only two days ago resets current_streak to 0', async ({
    page,
  }) => {
    await registerFreshUser(page);

    const today = cordobaLocalDate();
    const twoDaysAgo = addLocalDateDays(today, -2);
    // Instant that is still `twoDaysAgo` in Córdoba but already the next
    // calendar day in UTC (02:30Z = 23:30 Córdoba previous day).
    const utcNextDayStillCordobaPrevious = `${addLocalDateDays(twoDaysAgo, 1)}T02:30:00.000Z`;
    expect(cordobaLocalDate(new Date(utcNextDayStillCordobaPrevious))).toBe(twoDaysAgo);

    const created = await page.request.post('/api/workouts');
    const workout = await created.json();
    const ended = await page.request.patch(`/api/workouts/${workout.id}`, {
      data: { endedAt: utcNextDayStillCordobaPrevious },
    });
    expect(ended.status()).toBe(200);

    const streakRes = await page.request.get('/api/stats/streak');
    const streak = await streakRes.json();
    expect(streak.currentStreak).toBe(0);
    expect(streak.lastActiveDate).toBe(twoDaysAgo);
    expect(streak.longestStreak).toBeGreaterThanOrEqual(1);
  });

  test('cron streak-nudge returns 401 without secret', async ({ request }) => {
    const missing = await request.get(NUDGE_CRON_URL);
    expect(missing.status()).toBe(401);
    const missingBody = await missing.json();
    expect(missingBody.code).toBe('UNAUTHORIZED');

    const wrong = await request.get(NUDGE_CRON_URL, {
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    expect(wrong.status()).toBe(401);
    const wrongBody = await wrong.json();
    expect(wrongBody.code).toBe('UNAUTHORIZED');
  });

  test('cron streak-nudge is idempotent for the same Córdoba day', async ({ page, request }) => {
    await registerFreshUser(page);

    const yesterday = addLocalDateDays(cordobaLocalDate(), -1);
    const created = await page.request.post('/api/workouts');
    const workout = await created.json();
    const ended = await page.request.patch(`/api/workouts/${workout.id}`, {
      data: { endedAt: isoAtCordobaNoon(yesterday) },
    });
    expect(ended.status()).toBe(200);

    const auth = { Authorization: `Bearer ${CRON_SECRET}` };
    const first = await request.get(NUDGE_CRON_URL, { headers: auth });
    const second = await request.get(NUDGE_CRON_URL, { headers: auth });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);

    const body1 = await first.json();
    const body2 = await second.json();

    expect(body1.success).toBe(true);
    expect(body1.rule).toBe('active_yesterday_not_today');
    expect(body1.considered).toBeGreaterThanOrEqual(1);
    expect(body1.date).toBe(cordobaLocalDate());

    expect(body2.date).toBe(body1.date);
    expect(body2.recorded).toBe(0);
    expect(body2.considered).toBeGreaterThanOrEqual(body1.considered);
    expect(body2.skipped).toBeGreaterThanOrEqual(body1.recorded);
  });
});
