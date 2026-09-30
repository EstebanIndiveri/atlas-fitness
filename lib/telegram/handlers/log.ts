import * as workoutSetsService from '@/lib/services/workout-sets';
import * as workoutsService from '@/lib/services/workouts';
import { listCatalogExercises, nextSetIndex } from '@/lib/services/day-summary';
import { TELEGRAM_COPY } from '@/lib/telegram/copy';
import { matchExercise } from '@/lib/telegram/match-exercise';
import { parseLogArgs } from '@/lib/telegram/parse';
import { validateSemanticCapture } from '@/lib/progression/semantics';
import { SEMANTIC_CAPTURE_VERSION_1 } from '@/types/progression';
import { CALLBACK_END_WORKOUT } from '@/types/telegram';
import type { TelegramReply } from '@/types/telegram';
import type { HandlerContext } from './context';

function finishKeyboard() {
  return {
    inline_keyboard: [[{ text: TELEGRAM_COPY.finishKeyboardLabel, callback_data: CALLBACK_END_WORKOUT }]],
  };
}

export async function handleLog(ctx: HandlerContext): Promise<TelegramReply> {
  if (!ctx.user) {
    return { text: TELEGRAM_COPY.unlinked };
  }

  if (ctx.command.type !== 'log') {
    return { text: TELEGRAM_COPY.logUsage };
  }

  const parsed = parseLogArgs(ctx.command.raw);
  if (!parsed) {
    // Legacy three-argument syntax (or an incomplete command) never writes.
    return { text: TELEGRAM_COPY.logUsage };
  }

  // The domain owns validity; the parser only extracted explicit facts.
  const validation = validateSemanticCapture({
    semanticCaptureVersion: SEMANTIC_CAPTURE_VERSION_1,
    ...parsed.semantics,
    weightKg: parsed.weightKg,
    reps: parsed.reps,
  });
  if (!validation.ok) {
    return { text: TELEGRAM_COPY.logUsage };
  }

  const catalog = await listCatalogExercises(ctx.user.id);
  const match = matchExercise(parsed.exerciseQuery, catalog);

  if (match.status === 'none') {
    return { text: TELEGRAM_COPY.logExerciseNone(parsed.exerciseQuery) };
  }
  if (match.status === 'ambiguous') {
    return {
      text: TELEGRAM_COPY.logExerciseAmbiguous(match.exercises.map((item) => item.name)),
    };
  }

  let workout = await workoutsService.getActiveWorkout(ctx.user.id);
  if (!workout) {
    workout = await workoutsService.createWorkout(ctx.user.id);
  }

  const existingSets = await workoutSetsService.listWorkoutSets(workout.id, ctx.user.id);
  const created = await workoutSetsService.createWorkoutSet({
    workoutId: workout.id,
    userId: ctx.user.id,
    exerciseId: match.exercise.id,
    setIndex: nextSetIndex(existingSets),
    reps: parsed.reps,
    weightKg: parsed.weightKg,
    semanticCaptureVersion: SEMANTIC_CAPTURE_VERSION_1,
    ...parsed.semantics,
  });

  const confirmation = TELEGRAM_COPY.logOk({
    exercise: match.exercise.name,
    reps: created.reps,
    weightKg: created.weightKg,
    canonical: validation.canonical,
  });

  if (ctx.command.endAfter) {
    await workoutsService.updateWorkout(workout.id, ctx.user.id, { endedAt: new Date() });
    return { text: `${confirmation}\n${TELEGRAM_COPY.endOk}` };
  }

  return { text: confirmation, replyMarkup: finishKeyboard() };
}
