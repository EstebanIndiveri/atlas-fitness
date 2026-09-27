import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { buildRoutineDraft } from '@/lib/ai/routine-draft';
import { getEligibleRoutineExercises, normalizeRoutineDraftContext } from '@/lib/ai/routine-draft-selection';
import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { listExercises } from '@/lib/services/exercises';
import { AppError } from '@/types/errors';

const routineBriefSchema = z.object({
  goal: z.string().trim().min(2).max(160),
  focusAreas: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  availableEquipment: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  sessionLengthMinutes: z.number().int().min(15).max(180).optional(),
  // @deprecated Compatibility input; new clients must submit sessionLengthMinutes.
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  location: z.enum(['gym', 'home']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
}).superRefine((brief, context) => {
  if (brief.sessionLengthMinutes === undefined && brief.daysPerWeek === undefined) {
    context.addIssue({
      code: 'custom',
      message: 'La duración de la sesión es obligatoria',
      path: ['sessionLengthMinutes'],
    });
  }
});

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Brief de rutina inválido');
  }
}

/** @deprecated Old clients omit duration; frequency is validated but not used to infer session length. */
function legacyCoachSessionLengthMinutes(): number {
  return 45;
}

/**
 * POST /api/routines/coach — generate an authenticated Coach Atlas session draft.
 *
 * @param request Incoming request with goal, focus areas, location, level, and session duration; legacy daysPerWeek uses a fixed default duration.
 * @returns A routine draft whose exercise ids are validated against the user's visible catalog.
 * @throws {AppError} UNAUTHORIZED or VALIDATION through the shared API handler.
 * @example
 * await POST(new NextRequest('http://localhost/api/routines/coach', { method: 'POST' }));
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const parsed = routineBriefSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Brief de rutina inválido');
    }

    const catalog = await listExercises(session.userId);
    if (catalog.length === 0) {
      throw new AppError('VALIDATION', 'No hay ejercicios disponibles para armar una rutina.');
    }

    const { goal, focusAreas, availableEquipment, location, level } = parsed.data;
    const sessionLengthMinutes = parsed.data.sessionLengthMinutes ?? legacyCoachSessionLengthMinutes();
    const context = {
      goal,
      focusAreas: focusAreas ?? [],
      availableEquipment,
      location,
      level,
      sessionLengthMinutes,
      catalog,
    };
    if (new URL(request.url).searchParams.get('mode') === 'candidates') {
      const normalizedContext = normalizeRoutineDraftContext(context);
      return NextResponse.json(getEligibleRoutineExercises(normalizedContext));
    }

    const draft = await buildRoutineDraft({
      ...context,
    });
    return NextResponse.json(draft);
  } catch (error) {
    return handleApiError(error);
  }
}
