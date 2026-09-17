import type { TelegramReply, TelegramReplyMarkup } from '@/types/telegram';

const TELEGRAM_API = 'https://api.telegram.org';

export type TelegramSender = (
  chatId: number | string,
  text: string,
  replyMarkup?: TelegramReplyMarkup
) => Promise<void>;

let senderOverride: TelegramSender | null = null;

export function setTelegramSender(sender: TelegramSender | null): void {
  senderOverride = sender;
}

async function callTelegram(
  token: string,
  method: string,
  body: Record<string, unknown>
): Promise<void> {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.text();
    console.error(`Telegram ${method} failed`, response.status, payload);
  }
}

/**
 * Outbound sendMessage. No-ops when TELEGRAM_BOT_TOKEN is unset (CI / local without bot).
 * Tests should inject setTelegramSender instead of hitting the network.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: TelegramReplyMarkup
): Promise<void> {
  if (senderOverride) {
    await senderOverride(chatId, text, replyMarkup);
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return;
  }

  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function sendTelegramReply(
  chatId: number | string,
  reply: TelegramReply
): Promise<void> {
  await sendTelegramMessage(chatId, reply.text, reply.replyMarkup);
}

export async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || senderOverride) {
    return;
  }

  await callTelegram(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
  });
}
