import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { deactivateHabitTarget, putHabitTarget } from '@/lib/services/habit-targets';
import { AppError } from '@/types/errors';

type HabitTargetParams = { params: Promise<{ habitKey: string }> };

/**
 * Deactivation token as named by the public contract. The persistence service
 * takes the same pair as `{ targetId, version }`; the route only renames keys.
 */
const deactivationTokenSchema = z.object({
  expectedTargetId: z.number().int().positive(),
  expectedVersion: z.number().int().min(1),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new AppError('VALIDATION', 'Objetivo de hábito inválido');
  }
}

/**
 * PUT /api/habit-targets/[habitKey]
 *
 * Create or update the user's weekly target for one closed-catalog habit with
 * compare-and-swap: the body carries `weekdays` plus the
 * `{ expectedTargetId, expectedVersion }` pair (`null`/`null` to create). The
 * habit key, weekday invariants and token completeness are validated by the
 * persistence service, so the route stays a thin HTTP boundary. A `null` token
 * is the client's create intent and answers `201`; any other accepted write is
 * an update and answers `200`. Unknown habits are `404` and stale tokens `409`.
 */
export async function PUT(request: NextRequest, { params }: HabitTargetParams): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const { habitKey } = await params;
    const body = await readJsonBody(request);
    const target = await putHabitTarget(session.userId, habitKey, body);
    const isCreate = isRecord(body) && body.expectedTargetId === null;

    return NextResponse.json(target, { status: isCreate ? 201 : 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/habit-targets/[habitKey]
 *
 * Deactivate the user's current target for one habit. The `{ expectedTargetId,
 * expectedVersion }` pair protects the write with compare-and-swap, so a stale
 * token answers `409` while an already-absent target answers the idempotent
 * `{ activeTarget: null }`. History of versions started before today is closed,
 * never deleted, and `habit_logs` is untouched (v0.10 brief §6 / §9).
 */
export async function DELETE(
  request: NextRequest,
  { params }: HabitTargetParams,
): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const { habitKey } = await params;
    const body = await readJsonBody(request);
    const parsed = deactivationTokenSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Token de objetivo inválido');
    }

    const result = await deactivateHabitTarget(session.userId, habitKey, {
      targetId: parsed.data.expectedTargetId,
      version: parsed.data.expectedVersion,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
