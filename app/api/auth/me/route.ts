import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfileById } from '@/lib/services/auth';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { AppError } from '@/types/errors';

/**
 * GET /api/auth/me — returns authenticated identity and profile-owned plan metadata.
 *
 * @param request - Request carrying the authenticated session cookie.
 * @returns The current user profile including account creation date and active plan id.
 * @throws {AppError} NOT_FOUND when the authenticated user no longer exists.
 * @example await GET(request);
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    const user = await getAuthProfileById(session.userId);

    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}
