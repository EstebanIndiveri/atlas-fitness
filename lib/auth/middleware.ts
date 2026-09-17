import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from './session';
import { AppError } from '@/types/errors';
import type { SessionData } from '@/types/auth';

export interface AuthenticatedRequest extends NextRequest {
  userId?: number;
}

/**
 * Extracts session from request and validates authentication
 * Sets x-user-id header for authenticated requests
 */
export function requireAuth(request: NextRequest): SessionData {
  const cookieHeader = request.headers.get('cookie');
  const session = getSessionFromCookies(cookieHeader);

  if (!session || !session.userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  return session;
}

/**
 * Optional auth - returns session if present, null otherwise
 */
export function optionalAuth(request: NextRequest): SessionData | null {
  const cookieHeader = request.headers.get('cookie');
  return getSessionFromCookies(cookieHeader);
}

/**
 * Handles API errors and returns appropriate response
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const status = {
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      VALIDATION: 400,
      CONFLICT: 409,
    }[error.code];

    return NextResponse.json(error.toJSON(), { status });
  }

  console.error('Unexpected error:', error);
  return NextResponse.json(
    { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    { status: 500 },
  );
}
