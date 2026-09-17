import { consumeLinkCode } from '@/lib/services/telegram-link';
import { TELEGRAM_COPY } from '@/lib/telegram/copy';
import { isLinkCode } from '@/lib/telegram/parse';
import { AppError } from '@/types/errors';
import type { TelegramReply } from '@/types/telegram';
import type { HandlerContext } from './context';

export async function consumeAndReply(
  code: string,
  telegramUserId: string
): Promise<TelegramReply> {
  try {
    const user = await consumeLinkCode(code, telegramUserId);
    return { text: TELEGRAM_COPY.linkOk(user.name) };
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'VALIDATION') {
        return { text: TELEGRAM_COPY.linkExpired };
      }
      if (error.code === 'CONFLICT') {
        return { text: TELEGRAM_COPY.linkConflict };
      }
      return { text: TELEGRAM_COPY.linkInvalid };
    }
    throw error;
  }
}

export async function handleLink(ctx: HandlerContext): Promise<TelegramReply> {
  if (ctx.command.type !== 'link_code') {
    return { text: TELEGRAM_COPY.linkInvalid };
  }
  return consumeAndReply(ctx.command.code, ctx.telegramUserId);
}

export async function handleStart(ctx: HandlerContext): Promise<TelegramReply> {
  if (ctx.command.type === 'start' && ctx.command.payload && isLinkCode(ctx.command.payload)) {
    return consumeAndReply(ctx.command.payload, ctx.telegramUserId);
  }

  if (ctx.user) {
    return { text: TELEGRAM_COPY.startLinked(ctx.user.name) };
  }

  return { text: TELEGRAM_COPY.startUnlinked };
}
