/**
 * If TELEGRAM_WEBHOOK_SECRET is set, Telegram must send the same value in
 * X-Telegram-Bot-Api-Secret-Token. If unset, verification is skipped (dev/CI).
 */
export function isValidTelegramWebhookSecret(headerValue: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    return true;
  }
  return headerValue === expected;
}
