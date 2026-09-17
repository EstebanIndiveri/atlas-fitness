import { NextRequest, NextResponse } from 'next/server';
import { generateLinkCode } from '@/lib/services/auth';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    const session = requireAuth(request);

    const result = await generateLinkCode(session.userId);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
