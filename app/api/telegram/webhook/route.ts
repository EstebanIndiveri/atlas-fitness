import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/auth/middleware';
import { processTelegramUpdate } from '@/lib/telegram/process-update';
import { isValidTelegramWebhookSecret } from '@/lib/telegram/webhook-secret';
import { AppError } from '@/types/errors';

/**
 * POST /api/telegram/webhook
 * Thin Telegram webhook: verify optional secret, then processUpdate.
 * Auth is the bot secret (not session cookies). Idempotency is in processTelegramUpdate.
 */
export async function POST(request: NextRequest) {
  try {
    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    if (!isValidTelegramWebhookSecret(secretHeader)) {
      throw new AppError('UNAUTHORIZED', 'Webhook secret inválido');
    }

    const payload: unknown = await request.json();
    const result = await processTelegramUpdate(payload);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
