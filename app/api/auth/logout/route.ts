import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSessionFromCookies } from '@/lib/auth/session';
import { revokeSession } from '@/lib/auth/session-store';
import { handleApiError } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromCookies(request.headers.get('cookie'));
    if (session) {
      await revokeSession(session.sessionId);
    }

    const response = NextResponse.json({ success: true });
    response.headers.append('Set-Cookie', clearSessionCookie());
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
