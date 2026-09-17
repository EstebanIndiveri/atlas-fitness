import { getStreakForUser, isActiveDay } from '@/lib/services/streaks';
import { getOrCreateTodayTip } from '@/lib/services/tips';
import { TELEGRAM_COPY } from '@/lib/telegram/copy';
import { addLocalDateDays, cordobaLocalDate } from '@/lib/time/cordoba';
import type { TelegramReply } from '@/types/telegram';
import type { HandlerContext } from './context';

export async function handleReminder(ctx: HandlerContext): Promise<TelegramReply> {
  if (!ctx.user) {
    return { text: TELEGRAM_COPY.unlinked };
  }

  const today = cordobaLocalDate();
  const yesterday = addLocalDateDays(today, -1);
  const [streak, tip, activeToday, activeYesterday] = await Promise.all([
    getStreakForUser(ctx.user.id),
    getOrCreateTodayTip(today),
    isActiveDay(ctx.user.id, today),
    isActiveDay(ctx.user.id, yesterday),
  ]);

  const lines = [
    TELEGRAM_COPY.reminderRule,
    TELEGRAM_COPY.reminderStreak(streak.currentStreak, streak.longestStreak),
    TELEGRAM_COPY.reminderTip(tip.body),
  ];

  if (activeYesterday && !activeToday) {
    lines.push(TELEGRAM_COPY.reminderAtRisk);
  } else if (activeToday) {
    lines.push(TELEGRAM_COPY.reminderOk);
  }

  return { text: lines.join('\n\n') };
}
