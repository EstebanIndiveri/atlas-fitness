/**
 * @jest-environment node
 */
import { afterEach, describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/telegram/webhook/route';
import { isValidTelegramWebhookSecret } from './webhook-secret';

describe('isValidTelegramWebhookSecret', () => {
  it('rejects requests in production when the secret is missing', () => {
    expect(
      isValidTelegramWebhookSecret(null, { NODE_ENV: 'production' }),
    ).toBe(false);
    expect(
      isValidTelegramWebhookSecret('anything', {
        NODE_ENV: 'production',
        ALLOW_INSECURE_TELEGRAM_WEBHOOK: 'true',
      }),
    ).toBe(false);
  });

  it('rejects requests whenever TELEGRAM_BOT_TOKEN is set without a webhook secret', () => {
    expect(
      isValidTelegramWebhookSecret('anything', {
        NODE_ENV: 'development',
        TELEGRAM_BOT_TOKEN: '123:ABC',
      }),
    ).toBe(false);
  });

  it('accepts a matching secret with a timing-safe compare', () => {
    const env = {
      NODE_ENV: 'production',
      TELEGRAM_WEBHOOK_SECRET: 'hook-secret',
    };
    expect(isValidTelegramWebhookSecret('hook-secret', env)).toBe(true);
    expect(isValidTelegramWebhookSecret('wrong-secret', env)).toBe(false);
    expect(isValidTelegramWebhookSecret(null, env)).toBe(false);
    expect(isValidTelegramWebhookSecret('hook-secre', env)).toBe(false);
  });

  it('allows insecure mode only with an explicit non-production flag and no bot token', () => {
    expect(
      isValidTelegramWebhookSecret(null, {
        NODE_ENV: 'development',
        ALLOW_INSECURE_TELEGRAM_WEBHOOK: 'true',
      }),
    ).toBe(true);
    expect(
      isValidTelegramWebhookSecret(null, { NODE_ENV: 'development' }),
    ).toBe(false);
    expect(
      isValidTelegramWebhookSecret(null, {
        NODE_ENV: 'test',
        ALLOW_INSECURE_TELEGRAM_WEBHOOK: '1',
      }),
    ).toBe(true);
  });
});

describe('POST /api/telegram/webhook secret', () => {
  const originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalFlag = process.env.ALLOW_INSECURE_TELEGRAM_WEBHOOK;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;
    } else {
      process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret;
    }
    if (originalToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    }
    if (originalFlag === undefined) {
      delete process.env.ALLOW_INSECURE_TELEGRAM_WEBHOOK;
    } else {
      process.env.ALLOW_INSECURE_TELEGRAM_WEBHOOK = originalFlag;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  function request(secret: string | null): NextRequest {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (secret !== null) {
      headers['x-telegram-bot-api-secret-token'] = secret;
    }
    return new NextRequest('http://localhost:3000/api/telegram/webhook', {
      method: 'POST',
      headers,
      body: JSON.stringify({ update_id: Date.now() }),
    });
  }

  it('rejects without secret when a bot token is configured', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TELEGRAM_BOT_TOKEN = '123:ABC';
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.ALLOW_INSECURE_TELEGRAM_WEBHOOK;

    const response = await POST(request(null));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('accepts a matching X-Telegram-Bot-Api-Secret-Token', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'hook-secret';
    process.env.TELEGRAM_BOT_TOKEN = '123:ABC';

    const response = await POST(request('hook-secret'));
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
