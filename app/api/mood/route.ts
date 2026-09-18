import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { upsertDailyCheckin, getDailyCheckin } from '@/lib/services/daily-checkins';
import { cordobaLocalDate } from '@/lib/time/cordoba';

/**
 * GET /api/mood — today's checkin for the authenticated user (Córdoba date)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const checkin = await getDailyCheckin(session.userId, cordobaLocalDate());
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
    const body = await request.json();
    const { mood } = body;

    if (mood === undefined || typeof mood !== 'number') {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'El estado de ánimo debe estar entre 1 y 5' },
        { status: 400 },
      );
    }

    const checkin = await upsertDailyCheckin(session.userId, cordobaLocalDate(), mood);
    return NextResponse.json(checkin);
  } catch (error) {
    return handleApiError(error);
  }
}
