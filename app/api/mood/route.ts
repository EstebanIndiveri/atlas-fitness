import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertDailyCheckin } from '@/lib/services/daily-checkins';
import { getUserById } from '@/lib/services/auth';

/**
 * POST /api/mood
 * Saves mood for the current user for today (Córdoba timezone)
 */
export async function POST(request: NextRequest) {
  try {
    // Get session from cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'No has iniciado sesión' },
        { status: 401 }
      );
    }

    const { userId } = JSON.parse(sessionCookie.value);
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Sesión inválida' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { mood } = body;

    if (!mood || typeof mood !== 'number' || mood < 1 || mood > 5) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'El estado de ánimo debe estar entre 1 y 5' },
        { status: 400 }
      );
    }

    // Get today's date in Córdoba timezone
    const now = new Date();
    const cordobaDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Cordoba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    // Upsert the checkin
    const checkin = await upsertDailyCheckin(userId, cordobaDate, mood);

    return NextResponse.json(checkin);
  } catch (error) {
    console.error('Error saving mood:', error);

    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const appError = error as { code: string; message: string };
      return NextResponse.json(
        { code: appError.code, message: appError.message },
        { status: appError.code === 'VALIDATION' ? 400 : 500 }
      );
    }

    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Error al guardar el estado de ánimo' },
      { status: 500 }
    );
  }
}
