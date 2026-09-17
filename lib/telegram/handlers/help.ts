import { TELEGRAM_COPY } from '@/lib/telegram/copy';
import type { TelegramReply } from '@/types/telegram';
import type { HandlerContext } from './context';

export async function handleHelp(_ctx: HandlerContext): Promise<TelegramReply> {
  return { text: TELEGRAM_COPY.help };
}

export async function handleUnknown(_ctx: HandlerContext): Promise<TelegramReply> {
  return { text: TELEGRAM_COPY.unknown };
}
