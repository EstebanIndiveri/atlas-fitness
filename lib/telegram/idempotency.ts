import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { botMessages } from '@/lib/db/schema';
import { isUniqueConstraintError } from '@/lib/db/unique-error';
import type { TelegramUpdate } from '@/types/telegram';

export type IdempotencyRecord = { duplicate: true } | { duplicate: false; id: number };

/**
 * Inserts bot_messages keyed by telegram_update_id BEFORE any command side effect.
 * UNIQUE on telegram_update_id → duplicate (caller must no-op, HTTP 200).
 */
export async function recordTelegramUpdate(update: TelegramUpdate): Promise<IdempotencyRecord> {
  const telegramUpdateId = String(update.update_id);

  try {
    const [row] = await db
      .insert(botMessages)
      .values({
        telegramUpdateId,
        rawRequest: JSON.stringify(update),
      })
      .returning({ id: botMessages.id });

    return { duplicate: false, id: row.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { duplicate: true };
    }
    throw error;
  }
}

export async function storeTelegramResponse(
  id: number,
  response: string,
  userId: number | null
): Promise<void> {
  await db
    .update(botMessages)
    .set({ response, userId })
    .where(eq(botMessages.id, id));
}
