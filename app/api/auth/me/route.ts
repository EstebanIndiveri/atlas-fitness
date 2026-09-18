import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/services/auth';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { AppError } from '@/types/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    const user = await getUserById(session.userId);

    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}
