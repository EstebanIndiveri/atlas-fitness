import { timingSafeEqual } from 'crypto';

export const TELEGRAM_INSECURE_WEBHOOK_FLAG = 'ALLOW_INSECURE_TELEGRAM_WEBHOOK';

export type TelegramWebhookEnv = {
  NODE_ENV?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  ALLOW_INSECURE_TELEGRAM_WEBHOOK?: string;
};

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Production and any process with TELEGRAM_BOT_TOKEN require a matching
 * X-Telegram-Bot-Api-Secret-Token. Skipping verification is allowed only when
 * ALLOW_INSECURE_TELEGRAM_WEBHOOK is set in non-production without a bot token.
 */
export function isValidTelegramWebhookSecret(
  headerValue: string | null,
  env: TelegramWebhookEnv = process.env,
): boolean {
  const expected = env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? '';
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
  const isProduction = env.NODE_ENV === 'production';
  const allowInsecure = isTruthyFlag(env.ALLOW_INSECURE_TELEGRAM_WEBHOOK);
  const mustAuthenticate = isProduction || Boolean(botToken);

  if (!expected) {
    if (mustAuthenticate) {
      return false;
    }
    return allowInsecure;
  }

  if (headerValue === null) {
    return false;
  }

  return timingSafeEqualString(headerValue, expected);
}
