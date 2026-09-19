import { NextRequest } from 'next/server';
import { handleWorkoutQueueActionRequest } from '@/lib/api/handle-workout-queue-action';

/**
 * POST /api/workouts/[id]/skip
 * Remove the current exercise from this session queue (does not return).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleWorkoutQueueActionRequest(request, params, 'skip');
}
