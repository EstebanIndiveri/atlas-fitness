import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { SESSION_COOKIE_NAME, createSessionCookie, encodeSession } from './session';
import { buildSessionPayload } from './session-payload';
import type { SessionData } from '@/types/auth';

export async function persistSession(userId: number, now: Date = new Date()): Promise<SessionData> {
  const payload = buildSessionPayload(userId, now.getTime());

  await db.insert(sessions).values({
    id: payload.sessionId,
    userId,
    createdAt: now,
    expiresAt: new Date(payload.exp * 1000),
    revokedAt: null,
  });

  return payload;
}

export async function issueSessionCookie(userId: number, now: Date = new Date()): Promise<string> {
  const payload = await persistSession(userId, now);
  return createSessionCookie(payload);
}

export async function issueSessionCookieHeader(
  userId: number,
  now: Date = new Date(),
): Promise<string> {
  const payload = await persistSession(userId, now);
  return `${SESSION_COOKIE_NAME}=${encodeSession(payload)}`;
}

export async function isSessionActive(
  sessionId: string,
  userId: number,
  now: Date = new Date(),
): Promise<boolean> {
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);

  return row !== undefined;
}

export async function revokeSession(sessionId: string, now: Date = new Date()): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeAllUserSessions(
  userId: number,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
