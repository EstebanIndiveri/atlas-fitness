import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/types/errors';
import { isMissingDatabaseSchemaError } from '../db/errors';
import { getSessionFromCookies } from './session';
import { isSessionActive } from './session-store';
import type { SessionData } from '@/types/auth';

export interface AuthenticatedRequest extends NextRequest {
  userId?: number;
}

const UNAUTHORIZED_MESSAGE = 'Autenticación requerida';

/**
 * Extracts session from request and validates authentication + revocation.
 */
export async function requireAuth(request: NextRequest): Promise<SessionData> {
  const cookieHeader = request.headers.get('cookie');
  const session = getSessionFromCookies(cookieHeader);

  if (!session) {
    throw new AppError('UNAUTHORIZED', UNAUTHORIZED_MESSAGE);
  }

  const active = await isSessionActive(session.sessionId, session.userId);
  if (!active) {
    throw new AppError('UNAUTHORIZED', UNAUTHORIZED_MESSAGE);
  }

  return session;
}

/**
 * Optional auth - returns session if present and active, null otherwise
 */
export async function optionalAuth(request: NextRequest): Promise<SessionData | null> {
  const cookieHeader = request.headers.get('cookie');
  const session = getSessionFromCookies(cookieHeader);
  if (!session) {
    return null;
  }

  const active = await isSessionActive(session.sessionId, session.userId);
  return active ? session : null;
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
