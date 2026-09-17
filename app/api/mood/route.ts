import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { upsertDailyCheckin, getDailyCheckin } from '@/lib/services/daily-checkins';

function cordobaDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * GET /api/mood — today's checkin for the authenticated user (Córdoba date)
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireAuth(request);
    const checkin = await getDailyCheckin(session.userId, cordobaDate());
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
    const session = requireAuth(request);
    const body = await request.json();
    const { mood } = body;

    if (mood === undefined || typeof mood !== 'number') {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'El estado de ánimo debe estar entre 1 y 5' },
        { status: 400 },
      );
    }

    const checkin = await upsertDailyCheckin(session.userId, cordobaDate(), mood);
    return NextResponse.json(checkin);
  } catch (error) {
    return handleApiError(error);
  }
}
