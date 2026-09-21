'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { PostWorkoutFeedbackForm } from '@/components/session/PostWorkoutFeedbackForm';
import { formatImprovement, SESSION_COPY } from '@/lib/copy/session';
import { metric } from '@/types/metric';
import type {
  DiscomfortEntry,
  WorkoutSensation,
} from '@/lib/services/post-workout-feedback';
import type { GuidedCloseSummary } from '@/types/routine';

type SessionCloseScreenProps = {
  summary: GuidedCloseSummary | null;
  muscleGroups?: string[];
  effort: number | null;
  onEffort: (value: number) => void;
  sensation: WorkoutSensation | null;
  onSensation: (value: WorkoutSensation) => void;
  discomfort: DiscomfortEntry[];
  onDiscomfortChange: (entries: DiscomfortEntry[]) => void;
  note: string;
  onNoteChange: (value: string) => void;
  mood?: number | null;
  onMood?: (value: number) => void;
  onSave: () => void;
  saving: boolean;
  error?: string | null;
};

/**
 * Renders the guided session close screen and post-workout feedback form.
 *
 * @param props Session summary, controlled feedback fields, and save callbacks.
 * @returns Mobile-first close screen with sourced stats and accessible feedback inputs.
 * @example
 * <SessionCloseScreen summary={summary} effort={7} sensation="good" discomfort={[]} note="" />
 */
export function SessionCloseScreen({
  summary,
  muscleGroups = [],
  effort,
  onEffort,
  sensation,
  onSensation,
  discomfort,
  onDiscomfortChange,
  note,
  onNoteChange,
  onMood,
  onSave,
  saving,
  error = null,
}: SessionCloseScreenProps) {
  const subtitle = muscleGroups.length > 0
    ? muscleGroups.join(' · ')
    : SESSION_COPY.closeDefaultSubtitle;

  return (
    <Card className="overflow-hidden p-0" data-testid="session-close">
      <div className="bg-brand-muted/70 px-5 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success text-2xl text-success-foreground shadow-card">
          ✓
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-brand">
          {SESSION_COPY.closeEyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-ink">
          {SESSION_COPY.closeTitle}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
        <p className="mt-1 text-sm text-ink">{SESSION_COPY.closeCongrats}</p>
      </div>

      <div className="space-y-5 p-5">
        {summary ? <CloseStats summary={summary} /> : null}

        {summary ? (
          <p className="rounded-xl bg-canvas px-3 py-2 text-sm text-ink" data-testid="close-streak">
            {SESSION_COPY.streakLabel}:{' '}
            <MetricValue
              metric={metric(SESSION_COPY.streakDays(summary.streak.currentStreak), 'atlas_computed')}
              label={SESSION_COPY.streakLabel}
            />
          </p>
        ) : null}

        {summary?.improvements.map((item) => (
          <p key={item.exerciseId} className="text-sm text-ink" data-testid="close-improvement">
            {formatImprovement(item)}
          </p>
        ))}

        <PostWorkoutFeedbackForm
          effort={effort}
          onEffort={onEffort}
          sensation={sensation}
          onSensation={onSensation}
          onLegacyMood={onMood}
          discomfort={discomfort}
          onDiscomfortChange={onDiscomfortChange}
          note={note}
          onNoteChange={onNoteChange}
          disabled={saving}
          error={error}
        />

        <Button
          variant="success"
          size="lg"
          onClick={onSave}
          disabled={saving || effort === null || sensation === null}
          data-testid="close-save"
        >
          {SESSION_COPY.saveAndClose}
        </Button>
      </div>
    </Card>
  );
}

function CloseStats({ summary }: { summary: GuidedCloseSummary }) {
  const stats: { label: string; value: string }[] = [
    summary.stats.durationMinutes === null
      ? null
      : {
          label: SESSION_COPY.closeStatsDuration,
          value: `${summary.stats.durationMinutes} min`,
        },
    {
      label: SESSION_COPY.closeStatsSeries,
      value: SESSION_COPY.closeStatsCompleted(summary.stats.completedSets),
    },
    {
      label: SESSION_COPY.closeStatsVolume,
      value: `${summary.stats.totalVolumeKg} kg`,
    },
  ].filter((item) => item !== null);

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((item) => (
        <div
          key={item.label}
          aria-label={item.label}
          className="rounded-xl bg-surface p-3 text-center ring-1 ring-line"
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {item.label}
          </p>
          <MetricValue
            metric={metric(item.value, 'atlas_computed')}
            label={item.label}
            showSource
            className="mt-1 flex-col items-center gap-0 text-sm"
          />
        </div>
      ))}
    </div>
  );
}
