/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { db } from '@/lib/db/client';
import { sessions, users } from '@/lib/db/schema';
import {
  isSessionActive,
  persistSession,
  revokeAllUserSessions,
  revokeSession,
} from './session-store';

describe('session store', () => {
  let userId: number;

  beforeEach(async () => {
    await db.delete(sessions);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({
        name: 'Session Store',
        email: 'session-store@test.com',
        passwordHash: 'hash',
      })
      .returning();
    userId = user.id;
  });

  it('persists unique sessionIds for the same user (multi-device)', async () => {
    const first = await persistSession(userId);
    const second = await persistSession(userId);

    expect(first.sessionId).not.toBe(second.sessionId);
    await expect(isSessionActive(first.sessionId, userId)).resolves.toBe(true);
    await expect(isSessionActive(second.sessionId, userId)).resolves.toBe(true);
  });

  it('treats a revoked row as inactive', async () => {
    const payload = await persistSession(userId);
    await revokeSession(payload.sessionId);

    await expect(isSessionActive(payload.sessionId, userId)).resolves.toBe(false);
  });

  it('treats a missing row as inactive', async () => {
    await expect(isSessionActive('ab'.repeat(16), userId)).resolves.toBe(false);
  });

  it('revokes every active session for a user', async () => {
    const first = await persistSession(userId);
    const second = await persistSession(userId);

    await revokeAllUserSessions(userId);

    await expect(isSessionActive(first.sessionId, userId)).resolves.toBe(false);
    await expect(isSessionActive(second.sessionId, userId)).resolves.toBe(false);
  });

  it('treats an expired DB row as inactive', async () => {
    const past = new Date(Date.now() - 60_000);
    await db.insert(sessions).values({
      id: 'ef'.repeat(16),
      userId,
      createdAt: past,
      expiresAt: past,
      revokedAt: null,
    });

    await expect(isSessionActive('ef'.repeat(16), userId)).resolves.toBe(false);
  });
});
