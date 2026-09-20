import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getTodayCheckIn, recordDailyCheckIn } from '@/lib/services/daily-checkin';
import { AppError } from '@/types/errors';

type CheckInRequestInput = {
  userId: number;
  mood?: unknown;
  energy?: unknown;
  note?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new AppError('VALIDATION', 'Check-in diario inválido');
  }
}

function buildCheckInInput(userId: number, body: unknown): CheckInRequestInput {
  const input: CheckInRequestInput = { userId };

  if (!isRecord(body)) {
    return input;
  }

  if ('mood' in body) {
    input.mood = body.mood;
  }
  if ('energy' in body) {
    input.energy = body.energy;
  }
  if ('note' in body) {
    input.note = body.note;
  }

  return input;
}

/**
 * GET /api/checkin — today's full check-in for the authenticated user.
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
 * POST /api/checkin — upsert today's full check-in for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await readJsonBody(request);
    const checkin = await recordDailyCheckIn(buildCheckInInput(session.userId, body));
    return NextResponse.json(checkin);
  } catch (error) {
    return handleApiError(error);
  }
}
