import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { createGuidedTrainingPlan } from '@/lib/services/guided-training-plan';
import { AppError } from '@/types/errors';

/**
 * POST /api/training-plan/guided — atomically saves an accepted weekly proposal.
 *
 * @param request - Authenticated request containing a guided plan and client mutation ID.
 * @returns The created training plan and its persisted weekly schedule.
 * @throws {AppError} VALIDATION for malformed JSON or payloads, and the service's typed errors.
 * @example
 * await POST(new NextRequest('http://localhost/api/training-plan/guided', { method: 'POST' }));
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new AppError('VALIDATION', 'Propuesta semanal inválida');
    }

    const result = await createGuidedTrainingPlan(session.userId, input);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
