import { NextRequest } from 'next/server';
import { handleWorkoutQueueActionRequest } from '@/lib/api/handle-workout-queue-action';

/**
 * POST /api/workouts/[id]/hold
 * Move the current exercise to the end of this session queue (returns later).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleWorkoutQueueActionRequest(request, params, 'hold');
}
