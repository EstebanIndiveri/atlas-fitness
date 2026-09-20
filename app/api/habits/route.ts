import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getTodayHabitLogs, setHabitLog } from '@/lib/services/habit-logs';
import { AppError } from '@/types/errors';

type HabitLogRequestInput = {
  userId: number;
  habitKey?: unknown;
  done?: unknown;
  amount?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new AppError('VALIDATION', 'Registro de hábito inválido');
  }
}

function buildHabitLogInput(userId: number, body: unknown): HabitLogRequestInput {
  const input: HabitLogRequestInput = { userId };

  if (!isRecord(body)) {
    return input;
  }

  if ('habitKey' in body) {
    input.habitKey = body.habitKey;
  }
  if ('done' in body) {
    input.done = body.done;
  }
  if ('amount' in body) {
    input.amount = body.amount;
  }

  return input;
}

/**
 * GET /api/habits — today's habit logs for the authenticated user (Córdoba tz).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const logs = await getTodayHabitLogs(session.userId);
    return NextResponse.json(logs);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/habits — upsert one habit's completion state for today.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await readJsonBody(request);
    const log = await setHabitLog(buildHabitLogInput(session.userId, body));
    return NextResponse.json(log);
  } catch (error) {
    return handleApiError(error);
  }
}
