import { NextResponse } from 'next/server';
import { getOrCreateTodayTip } from '@/lib/services/tips';

/**
 * GET /api/tips/today
 * Returns the daily tip for today in America/Argentina/Cordoba timezone
 */
export async function GET() {
  try {
    const now = new Date();
    const cordobaDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Cordoba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const tip = await getOrCreateTodayTip(cordobaDate);

    return NextResponse.json(tip);
  } catch (error) {
    console.error('Error getting today tip:', error);

    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const appError = error as { code: string; message: string };
      return NextResponse.json(
        { code: appError.code, message: appError.message },
        { status: appError.code === 'NOT_FOUND' ? 404 : 500 }
      );
    }

    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Error al obtener el tip del día' },
      { status: 500 }
    );
  }
}
