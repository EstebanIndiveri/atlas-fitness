import { test, expect } from '@playwright/test';

const CRON_SECRET = process.env.CRON_SECRET || 'test-secret-for-e2e';
const CRON_URL = 'http://localhost:3000/api/cron/daily-tip';

test.describe('Daily Tip Cron Endpoint', () => {
  test('should return 401 when authorization header is missing', async ({ request }) => {
    const response = await request.get(CRON_URL);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 when CRON_SECRET is wrong', async ({ request }) => {
    const response = await request.get(CRON_URL, {
      headers: {
        Authorization: 'Bearer wrong-secret',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 200 and create tip with system fallback', async ({ request }) => {
    const response = await request.get(CRON_URL, {
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.tip).toBeDefined();
    expect(body.tip.source).toBe('system'); // Always fallback in current implementation
    expect(body.tip.body).toBeTruthy();
    expect(body.date).toBeTruthy();
  });

  test('should be idempotent - calling twice returns same tip', async ({ request }) => {
    const response1 = await request.get(CRON_URL, {
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    const response2 = await request.get(CRON_URL, {
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);

    const body1 = await response1.json();
    const body2 = await response2.json();

    // Both should return the same tip
    expect(body1.tip.id).toBe(body2.tip.id);
    expect(body1.tip.body).toBe(body2.tip.body);
    expect(body1.date).toBe(body2.date);
  });
});
