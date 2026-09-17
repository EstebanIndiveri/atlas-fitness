import type { AuthUser } from '@/types/auth';
import type { BotCommand } from '@/lib/telegram/parse';
import type { TelegramReply } from '@/types/telegram';

export interface HandlerContext {
  command: BotCommand;
  telegramUserId: string;
  chatId: number;
  user: AuthUser | null;
  text: string;
}

export type CommandHandler = (ctx: HandlerContext) => Promise<TelegramReply>;
