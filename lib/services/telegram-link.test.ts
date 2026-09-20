import { describe, it, expect, beforeEach } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  sessions,
  botMessages,
  dailyCheckins,
  streakNudges,
  telegramLinkCodes,
  users,
  userStreaks,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import { generateLinkCode, register } from '@/lib/services/auth';
import { consumeLinkCode } from '@/lib/services/telegram-link';
import { AppError } from '@/types/errors';

describe('consumeLinkCode', () => {
  beforeEach(async () => {
    await db.delete(botMessages);
    await db.delete(streakNudges);
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(telegramLinkCodes);
    await db.delete(userStreaks);
    await db.delete(sessions);
    await db.delete(users);
  });

  async function createUser(email: string) {
    return register({
      name: 'Link User',
      email,
      password: 'Test1234!',
    });
  }

  it('sets telegram_user_id and marks the code used', async () => {
    const user = await createUser('link-ok@test.com');
    const { code } = await generateLinkCode(user.id);

    const linked = await consumeLinkCode(code, '4242');

    expect(linked.id).toBe(user.id);
    expect(linked.telegramUserId).toBe('4242');

    const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    expect(dbUser?.telegramUserId).toBe('4242');

    const dbCode = await db.query.telegramLinkCodes.findFirst({
      where: eq(telegramLinkCodes.code, code),
    });
    expect(dbCode?.used).toBe(true);
  });

  it('rejects an unknown or already used code', async () => {
    const user = await createUser('link-used@test.com');
    const { code } = await generateLinkCode(user.id);
    await consumeLinkCode(code, '1001');

    await expect(consumeLinkCode(code, '1001')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<AppError>);

    await expect(consumeLinkCode('ZZZZZZZZ', '1001')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<AppError>);
  });

  it('rejects an expired code', async () => {
    const user = await createUser('link-exp@test.com');
    const { code } = await generateLinkCode(user.id);
    await db
      .update(telegramLinkCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(telegramLinkCodes.code, code));

    await expect(consumeLinkCode(code, '2002')).rejects.toMatchObject({
      code: 'VALIDATION',
    } satisfies Partial<AppError>);
  });

  it('rejects when the Telegram id belongs to another account', async () => {
    const first = await createUser('link-a@test.com');
    const second = await createUser('link-b@test.com');
    const { code: codeA } = await generateLinkCode(first.id);
    await consumeLinkCode(codeA, '7777');

    const { code: codeB } = await generateLinkCode(second.id);
    await expect(consumeLinkCode(codeB, '7777')).rejects.toMatchObject({
      code: 'CONFLICT',
    } satisfies Partial<AppError>);
  });
});
