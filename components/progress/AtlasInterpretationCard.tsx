import { Card } from '@/components/ui/Card';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import type { ProgressSummary } from '@/lib/services/progress-summary';
import type { WeekConsistency } from '@/types/week';
import { formatDurationMinutes } from './ProgressFormat';

interface AtlasInterpretationCardProps {
  summary: ProgressSummary;
  week: WeekConsistency | null;
}

function buildNarrative(summary: ProgressSummary, week: WeekConsistency | null): string {
  if (summary.completedSessions === 0 && (week?.activeCount ?? 0) === 0) {
    return PROGRESS_COPY.interpretation.empty;
  }

  const duration = formatDurationMinutes(summary.totalDurationMinutes);
  const sessionLabel = summary.completedSessions === 1 ? 'sesión' : 'sesiones';
  const weekPart = week
    ? ` Esta semana aparecen ${week.activeCount} de 7 días activos.`
    : ' La consistencia semanal todavía no está disponible.';

  return `En este período registraste ${summary.completedSessions} ${sessionLabel} y ${duration} de entrenamiento real.${weekPart}`;
}

/**
 * Coach Atlas narrative derived only from real progress data.
 *
 * @param props Progress summary and optional weekly consistency.
 * @returns Data-honest interpretation card.
 * @example
 * <AtlasInterpretationCard summary={summary} week={week} />
 */
export function AtlasInterpretationCard({ summary, week }: AtlasInterpretationCardProps) {
  return (
    <Card tone="brand" className="space-y-3 rounded-[28px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.interpretation.title}</h2>
        <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-brand">
          {PROGRESS_COPY.interpretation.eyebrow}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">{buildNarrative(summary, week)}</p>
    </Card>
  );
}
