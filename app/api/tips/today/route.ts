import { NextResponse } from 'next/server';
import { getOrCreateTodayTip } from '@/lib/services/tips';
import { cordobaLocalDate } from '@/lib/time/cordoba';

/**
 * GET /api/tips/today
 * Returns the daily tip for today in America/Argentina/Cordoba timezone
 */
export async function GET() {
  try {
    const tip = await getOrCreateTodayTip(cordobaLocalDate());

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
