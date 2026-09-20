import { handleEnd } from './end';
import { handleHelp, handleUnknown } from './help';
import { handleLink, handleStart } from './link';
import { handleLog } from './log';
import { handleReminder } from './reminder';
import { handleSummary } from './summary';
import type { CommandHandler, HandlerContext } from './context';
import type { TelegramReply } from '@/types/telegram';

/**
 * Thin command router. Business logic lives in one file per command.
 */
export async function dispatchCommand(ctx: HandlerContext): Promise<TelegramReply> {
  const handlers: Record<string, CommandHandler> = {
    start: handleStart,
    help: handleHelp,
    log: handleLog,
    summary: handleSummary,
    reminder: handleReminder,
    end: handleEnd,
    link_code: handleLink,
    unknown: handleUnknown,
  };

  const handler = handlers[ctx.command.type] ?? handleUnknown;
  return handler(ctx);
}
