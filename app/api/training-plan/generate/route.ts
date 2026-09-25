import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateWeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';
import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { enforceWeeklyPlanGenerateRateLimit } from '@/lib/auth/weekly-plan-rate-limit';
import { listExercises } from '@/lib/services/exercises';
import { AppError } from '@/types/errors';

const inputListSchema = z.array(z.string().trim().min(1).max(40)).max(8);
const weeklyPlanBriefSchema = z.object({
  goal: z.string().trim().min(2).max(60),
  daysPerWeek: z.number().int().min(1).max(6),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  availableEquipment: inputListSchema,
  sessionLengthMinutes: z.number().int().min(20).max(120),
  focusAreas: inputListSchema.max(6),
});

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Brief semanal inválido');
  }
}

/**
 * POST /api/training-plan/generate — builds a non-persistent weekly draft.
 *
 * @param request Authenticated request with a bounded training brief.
 * @returns A validated Gemini or deterministic fallback proposal.
 * @throws {AppError} UNAUTHORIZED or VALIDATION when auth, input, or catalog checks fail.
 * @example
 * await POST(new NextRequest('http://localhost/api/training-plan/generate', { method: 'POST' }));
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const parsed = weeklyPlanBriefSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Brief semanal inválido');
    }

    await enforceWeeklyPlanGenerateRateLimit(request, session.userId);
    const catalog = await listExercises(session.userId);
    if (catalog.length === 0) {
      throw new AppError('VALIDATION', 'No hay ejercicios disponibles para armar un plan semanal.');
    }

    const draft = await generateWeeklyPlanDraft({ ...parsed.data, catalog });
    return NextResponse.json(draft);
  } catch (error) {
    return handleApiError(error);
  }
}
