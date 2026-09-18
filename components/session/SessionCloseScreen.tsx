'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatImprovement, MOOD_EMOJIS, SESSION_COPY } from '@/lib/copy/session';
import { cn } from '@/lib/ui/cn';
import type { GuidedCloseSummary } from '@/types/routine';

type SessionCloseScreenProps = {
  summary: GuidedCloseSummary | null;
  mood: number | null;
  onMood: (value: number) => void;
  onSave: () => void;
  saving: boolean;
};

export function SessionCloseScreen({
  summary,
  mood,
  onMood,
  onSave,
  saving,
}: SessionCloseScreenProps) {
  return (
    <Card className="p-4" data-testid="session-close">
      <h1 className="text-2xl font-bold text-ink">{SESSION_COPY.closeTitle}</h1>
      <p className="mt-2 text-ink">{SESSION_COPY.closeCongrats}</p>

      {summary ? (
        <p className="mt-4 text-sm text-ink" data-testid="close-streak">
          {SESSION_COPY.streakLabel}: {SESSION_COPY.streakDays(summary.streak.currentStreak)}
        </p>
      ) : null}

      {summary?.improvements.map((item) => (
        <p key={item.exerciseId} className="mt-2 text-sm text-ink" data-testid="close-improvement">
          {formatImprovement(item)}
        </p>
      ))}

      <p className="mt-6 mb-2 text-sm font-medium text-ink">{SESSION_COPY.moodLabel}</p>
      <div className="flex justify-between gap-2">
        {MOOD_EMOJIS.map(({ value, emoji, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onMood(value)}
            aria-pressed={mood === value}
            aria-label={label}
            className={cn(
              'rounded-md p-2 text-3xl',
              mood === value ? 'bg-brand-muted' : 'opacity-50 hover:opacity-100',
            )}
            data-testid={`close-mood-${value}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <Button
        variant="success"
        className="mt-6"
        size="lg"
        onClick={onSave}
        disabled={saving || mood === null}
        data-testid="close-save"
      >
        {SESSION_COPY.saveAndClose}
      </Button>
    </Card>
  );
}
