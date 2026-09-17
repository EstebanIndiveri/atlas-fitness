import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/lib/services/auth';
import { createSessionCookie } from '@/lib/auth/session';
import { handleApiError } from '@/lib/auth/middleware';
import type { RegisterInput } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    const body: RegisterInput = await request.json();

    const user = await register(body);

    const response = NextResponse.json(user, { status: 201 });
    response.headers.append('Set-Cookie', createSessionCookie({ userId: user.id }));

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
