import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/services/auth';
import { issueSessionCookie } from '@/lib/auth/session-store';
import { handleApiError } from '@/lib/auth/middleware';
import type { LoginInput } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    const body: LoginInput = await request.json();

    const user = await login(body);

    const response = NextResponse.json(user);
    response.headers.append('Set-Cookie', await issueSessionCookie(user.id));

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
