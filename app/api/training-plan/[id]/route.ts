import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getTrainingPlanById, updateTrainingPlan } from '@/lib/services/training-plan';
import { AppError } from '@/types/errors';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePlanId(id: string): number {
  if (!/^[1-9]\d*$/.test(id)) {
    throw new AppError('VALIDATION', 'ID de plan inválido');
  }
  return Number(id);
}

async function readJsonObjectBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      throw new AppError('VALIDATION', 'Plan inválido');
    }
    return body;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('VALIDATION', 'Plan inválido');
  }
}

function omitUserId(body: Record<string, unknown>): Record<string, unknown> {
  const input = { ...body };
  delete input.userId;
  return input;
}

/**
 * GET /api/training-plan/[id] — loads one owned weekly training plan.
 *
 * @param request - Next.js request with authenticated session cookie.
 * @param context - Dynamic route params containing the training plan id.
 * @returns JSON response containing the plan and schedule.
 * @throws {AppError} VALIDATION when the id is invalid; NOT_FOUND for missing or foreign plans.
 * @example
 * await GET(request, { params: Promise.resolve({ id: '10' }) });
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const result = await getTrainingPlanById(session.userId, parsePlanId(id));
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/training-plan/[id] — updates one owned weekly training plan.
 *
 * @param request - Next.js request with authenticated session cookie and JSON plan payload.
 * @param context - Dynamic route params containing the training plan id.
 * @returns JSON response containing the updated plan and replacement schedule.
 * @throws {AppError} VALIDATION when JSON/id/payload are invalid; NOT_FOUND for missing or foreign plans.
 * @example
 * await PATCH(request, { params: Promise.resolve({ id: '10' }) });
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonObjectBody(request);
    const result = await updateTrainingPlan(session.userId, parsePlanId(id), omitUserId(body));
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
