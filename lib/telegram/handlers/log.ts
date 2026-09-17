import * as workoutSetsService from '@/lib/services/workout-sets';
import * as workoutsService from '@/lib/services/workouts';
import { listCatalogExercises, nextSetIndex } from '@/lib/services/day-summary';
import { TELEGRAM_COPY } from '@/lib/telegram/copy';
import { matchExercise } from '@/lib/telegram/match-exercise';
import { parseLogArgs } from '@/lib/telegram/parse';
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
  await workoutSetsService.createWorkoutSet({
    workoutId: workout.id,
    userId: ctx.user.id,
    exerciseId: match.exercise.id,
    setIndex: nextSetIndex(existingSets),
    reps: parsed.reps,
    weightKg: parsed.weightKg,
  });

  if (ctx.command.endAfter) {
    await workoutsService.updateWorkout(workout.id, ctx.user.id, { endedAt: new Date() });
    return {
      text: `${TELEGRAM_COPY.logOk(match.exercise.name, parsed.reps, parsed.weightKg)}\n${TELEGRAM_COPY.endOk}`,
    };
  }

  return {
    text: TELEGRAM_COPY.logOk(match.exercise.name, parsed.reps, parsed.weightKg),
    replyMarkup: finishKeyboard(),
  };
}
