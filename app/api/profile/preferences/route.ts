import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import {
  getUserPreferences,
  saveUserPreferences,
  saveUserPreferencesIfMissing,
} from '@/lib/services/user-preferences';
import { AppError } from '@/types/errors';

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Preferencias del perfil inválidas');
  }
}

/**
 * GET /api/profile/preferences — returns the authenticated user's saved preferences.
 *
 * @param request - Request carrying the authenticated session cookie.
 * @returns Stored preference IDs and whether a row has been explicitly saved.
 * @example
 * await GET(request);
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const preferences = await getUserPreferences(session.userId);
    return NextResponse.json(preferences);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/profile/preferences — replaces preference values for the authenticated user.
 *
 * @param request - Request with an authenticated session and preference JSON body.
 * @returns The validated preference IDs persisted for the authenticated user with saved-row metadata.
 * @throws {AppError} VALIDATION when JSON is malformed or preference IDs are invalid.
 * @example
 * await PUT(request);
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const body = await readJsonBody(request);
    const preferences =
      request.headers.get('if-none-match') === '*'
        ? await saveUserPreferencesIfMissing(session.userId, body)
        : await saveUserPreferences(session.userId, body);
    return NextResponse.json(preferences);
  } catch (error) {
    return handleApiError(error);
  }
}
