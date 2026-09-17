import { NextRequest, NextResponse } from 'next/server';
import { ensureTodayTip } from '@/lib/services/tips';

/**
 * GET /api/cron/daily-tip
 * Cron job to create/ensure today's daily tip
 * Protected by Bearer token (CRON_SECRET)
 * 
 * Tries AI generation if configured (future enhancement)
 * Always falls back to system tip if AI missing/fails
 */
export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get today's date in America/Argentina/Cordoba
    const now = new Date();
    const cordobaDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Cordoba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    // TODO: Future enhancement - try AI generation here
    // For now, we always use null which falls back to system tips
    const aiContent: string | null = null;

    // Ensure today's tip exists (idempotent)
    const tip = await ensureTodayTip(cordobaDate, aiContent);

    return NextResponse.json({
      success: true,
      tip,
      date: cordobaDate,
    });
  } catch (error) {
    console.error('Error in daily tip cron:', error);

    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const appError = error as { code: string; message: string };
      return NextResponse.json(
        { code: appError.code, message: appError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Error al procesar el cron de tips' },
      { status: 500 }
    );
  }
}
