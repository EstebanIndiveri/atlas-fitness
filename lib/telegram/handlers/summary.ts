import { getDaySummary } from '@/lib/services/day-summary';
import { TELEGRAM_COPY } from '@/lib/telegram/copy';
import { describeRecordedAmount, LEGACY_AMOUNT_LABEL } from '@/lib/format/amount';
import { canonicalSemantics } from '@/lib/progression/semantics';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import type { TelegramReply } from '@/types/telegram';
import type { DaySummarySet } from '@/lib/services/day-summary';
import type { HandlerContext } from './context';

/** Mode-aware amount label; legacy/unknown rows never claim "kg levantados". */
function amountLabel(set: DaySummarySet): string {
  const canonical = canonicalSemantics(set.semanticCaptureVersion, {
    loadMode: set.loadMode,
    amountBasis: set.amountBasis,
    side: set.side,
    setPurpose: set.setPurpose,
    repCountBasis: set.repCountBasis,
  });
  if (canonical.status !== 'canonical') {
    return LEGACY_AMOUNT_LABEL;
  }
  return describeRecordedAmount(canonical.tuple, set.weightKg);
}

export async function handleSummary(ctx: HandlerContext): Promise<TelegramReply> {
  if (!ctx.user) {
    return { text: TELEGRAM_COPY.unlinked };
  }

  const localDate = cordobaLocalDate();
  const summary = await getDaySummary(ctx.user.id, localDate);

  if (summary.setCount === 0) {
    const empty = TELEGRAM_COPY.summaryEmpty(localDate);
    if (summary.hasOpenWorkout) {
      return { text: `${empty}\n${TELEGRAM_COPY.summaryOpenWorkout}` };
    }
    return { text: empty };
  }

  const lines = [TELEGRAM_COPY.summaryHeader(localDate, summary.setCount)];
  for (const workout of summary.workouts) {
    for (const set of workout.sets) {
      lines.push(TELEGRAM_COPY.summarySetLine(set.exerciseName, set.reps, amountLabel(set)));
    }
  }
  if (summary.hasOpenWorkout) {
    lines.push(TELEGRAM_COPY.summaryOpenWorkout);
  }

  return { text: lines.join('\n') };
}
