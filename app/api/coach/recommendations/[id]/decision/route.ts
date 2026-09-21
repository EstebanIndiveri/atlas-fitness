import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { decideCoachRecommendation } from '@/lib/services/coach-recommendation';
import { AppError } from '@/types/errors';

async function readJsonObject(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Decisión de Coach Atlas inválida');
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('VALIDATION', 'Decisión de Coach Atlas inválida');
  }

  return { ...body };
}

function parseRecommendationId(id: string): number {
  const recommendationId = parseInt(id, 10);
  if (!/^\d+$/.test(id) || Number.isNaN(recommendationId) || recommendationId <= 0) {
    throw new AppError('VALIDATION', 'ID de recomendación inválido');
  }

  return recommendationId;
}

/**
 * POST /api/coach/recommendations/[id]/decision — accept or reject an owned recommendation.
 *
 * @param request Incoming Next.js request with `{ decision: 'accepted' | 'rejected' }`.
 * @param context Promise-backed route params containing the recommendation id.
 * @returns The decided Coach Atlas recommendation DTO.
 * @throws {AppError} UNAUTHORIZED, VALIDATION, NOT_FOUND, or CONFLICT via the shared API handler.
 * @example
 * await POST(request, { params: Promise.resolve({ id: '1' }) });
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const recommendationId = parseRecommendationId(id);
    const body = await readJsonObject(request);
    const recommendation = await decideCoachRecommendation({
      ...body,
      id: recommendationId,
      userId: session.userId,
    });

    return NextResponse.json(recommendation);
  } catch (error) {
    return handleApiError(error);
  }
}
