import { NextRequest, NextResponse } from 'next/server';
import { runStreakNudges } from '@/lib/services/streaks';
import { TELEGRAM_COPY } from '@/lib/telegram/copy';
import { notifyLinkedTelegramUsers } from '@/lib/telegram/notify-linked';

/**
 * GET /api/cron/streak-nudge
 *
 * Nudge rule: users who were active yesterday (Córdoba) but not yet today.
 * Stores an idempotent intent row in `streak_nudges` (kind = streak_at_risk).
 * Newly recorded rows are sent to Telegram when the user is linked.
 * Re-runs the same day do not duplicate DB rows or resend.
 * Protected by Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const result = await runStreakNudges();
    const notified = await notifyLinkedTelegramUsers(
      result.recordedUserIds,
      TELEGRAM_COPY.reminderAtRisk
    );

    return NextResponse.json({
      success: true,
      ...result,
      notified,
    });
  } catch (error) {
    console.error('Error in streak nudge cron:', error);

    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const appError = error as { code: string; message: string };
      return NextResponse.json(
        { code: appError.code, message: appError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Error al procesar el cron de racha' },
      { status: 500 }
    );
  }
}
