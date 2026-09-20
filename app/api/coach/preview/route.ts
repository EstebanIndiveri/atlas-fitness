import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { previewCoachAdaptation } from '@/lib/services/coach-preview';
import { AppError } from '@/types/errors';

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Preview de Coach Atlas inválido');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildPreviewInput(userId: number, body: unknown): unknown {
  if (!isRecord(body)) {
    return { userId };
  }

  return { ...body, userId };
}

/**
 * POST /api/coach/preview — authenticated read-only Coach Atlas adaptation preview.
 *
 * @param request Incoming Next.js request with JSON body containing the routine and optional context.
 * @returns Original vs adapted routine summary and explanation; no database writes are performed.
 * @throws {AppError} UNAUTHORIZED, VALIDATION, or NOT_FOUND through the shared API handler.
 * @example
 * await POST(new NextRequest('http://localhost/api/coach/preview', { method: 'POST' }));
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await readJsonBody(request);
    const result = await previewCoachAdaptation(buildPreviewInput(session.userId, body));
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
