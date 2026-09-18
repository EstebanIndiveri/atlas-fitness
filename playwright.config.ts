import { defineConfig, devices } from '@playwright/test';

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'ci-atlas-session-secret-9f3a7c1e5b8d2a4c6e0f1b3d5a7c9e2f';
const TELEGRAM_WEBHOOK_SECRET =
  process.env.TELEGRAM_WEBHOOK_SECRET || 'ci-telegram-webhook-secret-not-prod';

process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;
process.env.SESSION_SECRET = SESSION_SECRET;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || 'file:./local.db',
      SESSION_SECRET,
      CRON_SECRET: process.env.CRON_SECRET || 'test-secret-for-e2e',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_WEBHOOK_SECRET,
      GEMINI_API_KEY: '',
    },
  },
});
