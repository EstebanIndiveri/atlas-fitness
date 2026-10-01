import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';

/**
 * GET /api/stats/prs — RETIRED (Atlas Fitness v0.12).
 *
 * The legacy personal-record contract compared a bare `weight_kg` per exercise
 * and could treat an open/incomplete set or an equal weight as a record. That
 * value may now mean external load, per-side load, added load, assistance
 * magnitude or the bodyweight zero sentinel, so it is not a truthful source for
 * any user-facing claim. v0.12 replaces it with the versioned progression read
 * model (`GET /api/exercises/[id]/progression`).
 *
 * The route stays as a typed tombstone so outdated clients fail loudly with
 * `410 Gone` and `PR_CONTRACT_RETIRED` instead of reading a misleading payload.
 * There is exactly one user-facing PR definition after v0.12.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    return NextResponse.json(
      {
        code: 'PR_CONTRACT_RETIRED',
        message:
          'El contrato de récord por peso se retiró en v0.12. Usá la progresión por ejercicio.',
      },
      { status: 410 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
