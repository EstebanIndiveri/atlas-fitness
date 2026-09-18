import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from './session';
import { AppError } from '@/types/errors';
import { isMissingDatabaseSchemaError } from '../db/errors';
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
  const statusByCode = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION: 400,
    CONFLICT: 409,
    SERVICE_UNAVAILABLE: 503,
  } as const;

  if (error instanceof AppError) {
    return NextResponse.json(error.toJSON(), { status: statusByCode[error.code] });
  }

  if (isMissingDatabaseSchemaError(error)) {
    console.error('Database schema unavailable; returning sanitized 503 response.');
    const unavailableError = new AppError(
      'SERVICE_UNAVAILABLE',
      'Servicio temporalmente no disponible',
    );

    return NextResponse.json(unavailableError.toJSON(), {
      status: statusByCode.SERVICE_UNAVAILABLE,
    });
  }

  console.error('Unexpected error in API handler.');
  return NextResponse.json(
    { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    { status: 500 },
  );
}
