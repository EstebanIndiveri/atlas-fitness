import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateRoutineDraft } from '@/lib/ai/routine-draft';
import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { listExercises } from '@/lib/services/exercises';
import { AppError } from '@/types/errors';

const routineBriefSchema = z.object({
  goal: z.string().trim().min(2).max(160),
  daysPerWeek: z.number().int().min(1).max(7),
  location: z.enum(['gym', 'home']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
});

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Brief de rutina inválido');
  }
}

/**
 * POST /api/routines/coach — generate an authenticated Coach Atlas routine draft.
 *
 * @param request Incoming Next.js request with goal, daysPerWeek, location, and level.
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

    const draft = await generateRoutineDraft(parsed.data, catalog);
    return NextResponse.json(draft);
  } catch (error) {
    return handleApiError(error);
  }
}
