import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { recordCoachRecommendation } from '@/lib/services/coach-recommendation';
import { AppError } from '@/types/errors';

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Recomendación de Coach Atlas inválida');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildRecordInput(userId: number, body: unknown): unknown {
  if (!isRecord(body)) {
    return { userId };
  }

  return { ...body, userId };
}

/**
 * POST /api/coach/recommendations — persist an authenticated Coach Atlas recommendation.
 *
 * @param request Incoming Next.js request with recommendation payload; client userId is ignored.
 * @returns The persisted pending Coach Atlas recommendation DTO.
 * @throws {AppError} UNAUTHORIZED, VALIDATION, NOT_FOUND, or CONFLICT via the shared API handler.
 * @example
 * await POST(new NextRequest('http://localhost/api/coach/recommendations', { method: 'POST' }));
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await readJsonBody(request);
    const recommendation = await recordCoachRecommendation(buildRecordInput(session.userId, body));
    return NextResponse.json(recommendation, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
