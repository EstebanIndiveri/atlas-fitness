import * as workoutsService from '@/lib/services/workouts';
import { TELEGRAM_COPY } from '@/lib/telegram/copy';
import type { TelegramReply } from '@/types/telegram';
import type { HandlerContext } from './context';

export async function handleEnd(ctx: HandlerContext): Promise<TelegramReply> {
  if (!ctx.user) {
    return { text: TELEGRAM_COPY.unlinked };
  }

  const active = await workoutsService.getActiveWorkout(ctx.user.id);
  if (!active) {
    return { text: TELEGRAM_COPY.endNone };
  }

  await workoutsService.updateWorkout(active.id, ctx.user.id, { endedAt: new Date() });
  return { text: TELEGRAM_COPY.endOk };
}
