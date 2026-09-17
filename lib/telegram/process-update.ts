import { AppError } from '@/types/errors';
import type { ProcessUpdateResult, TelegramUpdate } from '@/types/telegram';
import { getUserByTelegramId } from '@/lib/services/telegram-link';
import { answerCallbackQuery, sendTelegramReply } from '@/lib/telegram/client';
import { dispatchCommand } from '@/lib/telegram/handlers';
import type { HandlerContext } from '@/lib/telegram/handlers/context';
import { recordTelegramUpdate, storeTelegramResponse } from '@/lib/telegram/idempotency';
import { parseCallbackData, parseMessageText } from '@/lib/telegram/parse';

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return typeof (value as { update_id?: unknown }).update_id === 'number';
}

function extractContext(update: TelegramUpdate): Omit<HandlerContext, 'user'> | null {
  if (update.callback_query) {
    const callback = update.callback_query;
    return {
      command: parseCallbackData(callback.data ?? ''),
      telegramUserId: String(callback.from.id),
      chatId: callback.message?.chat.id ?? callback.from.id,
      text: callback.data ?? '',
    };
  }

  const message = update.message;
  if (!message?.from || !message.text) {
    return null;
  }

  return {
    command: parseMessageText(message.text),
    telegramUserId: String(message.from.id),
    chatId: message.chat.id,
    text: message.text,
  };
}

/**
 * Idempotent webhook processor: persist update_id first, then dispatch.
 * Duplicate telegram_update_id → no second side effect.
 */
export async function processTelegramUpdate(payload: unknown): Promise<ProcessUpdateResult> {
  if (!isTelegramUpdate(payload)) {
    throw new AppError('VALIDATION', 'Update de Telegram inválido');
  }

  const recorded = await recordTelegramUpdate(payload);
  if (recorded.duplicate) {
    return { ok: true, duplicate: true };
  }

  const extracted = extractContext(payload);
  if (!extracted) {
    await storeTelegramResponse(recorded.id, 'ignored', null);
    return { ok: true, duplicate: false };
  }

  const user = await getUserByTelegramId(extracted.telegramUserId);
  const ctx: HandlerContext = { ...extracted, user };
  const reply = await dispatchCommand(ctx);

  await sendTelegramReply(ctx.chatId, reply);
  if (payload.callback_query) {
    await answerCallbackQuery(payload.callback_query.id);
  }

  await storeTelegramResponse(recorded.id, reply.text, user?.id ?? null);
  return { ok: true, duplicate: false };
}
