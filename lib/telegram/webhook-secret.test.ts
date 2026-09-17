import { describe, it, expect, afterEach } from '@jest/globals';
import { isValidTelegramWebhookSecret } from './webhook-secret';

describe('isValidTelegramWebhookSecret', () => {
  const original = process.env.TELEGRAM_WEBHOOK_SECRET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;
    } else {
      process.env.TELEGRAM_WEBHOOK_SECRET = original;
    }
  });

  it('allows all requests when secret is not configured', () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect(isValidTelegramWebhookSecret(null)).toBe(true);
    expect(isValidTelegramWebhookSecret('anything')).toBe(true);
  });

  it('requires the header to match when secret is configured', () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'hook-secret';
    expect(isValidTelegramWebhookSecret('hook-secret')).toBe(true);
    expect(isValidTelegramWebhookSecret('wrong')).toBe(false);
    expect(isValidTelegramWebhookSecret(null)).toBe(false);
  });
});
