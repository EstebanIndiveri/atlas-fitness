import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getTodayCheckIn, recordDailyCheckIn } from '@/lib/services/daily-checkin';

function getMoodFromBody(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || !('mood' in body)) {
    return undefined;
  }

  return body.mood;
}

function isValidMood(mood: unknown): mood is number {
  return typeof mood === 'number' && Number.isInteger(mood) && mood >= 1 && mood <= 5;
}

/**
 * GET /api/mood — today's checkin for the authenticated user (Córdoba date)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const checkin = await getTodayCheckIn(session.userId);
    return NextResponse.json(checkin);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/mood — upsert mood for today (Córdoba date)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body: unknown = await request.json();
    const mood = getMoodFromBody(body);

    if (!isValidMood(mood)) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'El estado de ánimo debe estar entre 1 y 5' },
        { status: 400 },
      );
    }

    const checkin = await recordDailyCheckIn({ userId: session.userId, mood });
    return NextResponse.json(checkin);
  } catch (error) {
    return handleApiError(error);
  }
}
