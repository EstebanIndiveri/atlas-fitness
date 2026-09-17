import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { telegramLinkCodes, users } from '@/lib/db/schema';
import { isUniqueConstraintError } from '@/lib/db/unique-error';
import { AppError } from '@/types/errors';
import type { AuthUser } from '@/types/auth';
import { isLinkCode } from '@/lib/telegram/parse';

function toAuthUser(user: typeof users.$inferSelect): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    telegramUserId: user.telegramUserId,
  };
}

export async function getUserByTelegramId(telegramUserId: string): Promise<AuthUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.telegramUserId, telegramUserId),
  });
  return user ? toAuthUser(user) : null;
}

/**
 * Consumes a short-lived link code: sets users.telegram_user_id and marks the code used.
 */
export async function consumeLinkCode(
  rawCode: string,
  telegramUserId: string
): Promise<AuthUser> {
  const code = rawCode.trim().toUpperCase();
  if (!isLinkCode(code) || !telegramUserId.trim()) {
    throw new AppError('VALIDATION', 'Código de vinculación inválido');
  }

  const row = await db.query.telegramLinkCodes.findFirst({
    where: eq(telegramLinkCodes.code, code),
  });

  if (!row || row.used) {
    throw new AppError('NOT_FOUND', 'Código de vinculación inválido o ya usado');
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError('VALIDATION', 'El código de vinculación venció');
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.telegramUserId, telegramUserId),
  });
  if (existing && existing.id !== row.userId) {
    throw new AppError('CONFLICT', 'Este Telegram ya está vinculado a otra cuenta');
  }

  try {
    const [updatedUser] = await db.transaction(async (tx) => {
      const consumed = await tx
        .update(telegramLinkCodes)
        .set({ used: true })
        .where(
          and(
            eq(telegramLinkCodes.id, row.id),
            eq(telegramLinkCodes.used, false),
            gt(telegramLinkCodes.expiresAt, new Date())
          )
        )
        .returning();

      if (consumed.length === 0) {
        throw new AppError('NOT_FOUND', 'Código de vinculación inválido o ya usado');
      }

      return tx
        .update(users)
        .set({ telegramUserId })
        .where(eq(users.id, row.userId))
        .returning();
    });

    return toAuthUser(updatedUser);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError('CONFLICT', 'Este Telegram ya está vinculado a otra cuenta');
    }
    throw error;
  }
}
