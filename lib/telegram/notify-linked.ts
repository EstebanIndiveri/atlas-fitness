import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { sendTelegramMessage } from '@/lib/telegram/client';

/**
 * Sends `text` to users that have telegram_user_id. Skips the rest.
 * Outbound HTTP is stubbed in tests via setTelegramSender / missing token.
 */
export async function notifyLinkedTelegramUsers(
  userIds: number[],
  text: string
): Promise<number> {
  let notified = 0;
  for (const userId of userIds) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { telegramUserId: true },
    });
    if (!user?.telegramUserId) {
      continue;
    }
    await sendTelegramMessage(user.telegramUserId, text);
    notified += 1;
  }
  return notified;
}
