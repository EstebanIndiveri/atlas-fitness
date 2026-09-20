'use client';

import { Button } from '@/components/ui/Button';
import { SESSION_COPY } from '@/lib/copy/session';

export type SessionQueueItem = {
  exerciseId: number;
  name: string;
  current: boolean;
  held: boolean;
};

type SessionQueueActionsProps = {
  items: readonly SessionQueueItem[];
  onSkip: () => void;
  onHold: () => void;
  busy: boolean;
  error: string | null;
};

export function SessionQueueActions({
  items,
  onSkip,
  onHold,
  busy,
  error,
}: SessionQueueActionsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mb-4" aria-labelledby="session-queue-heading" data-testid="session-queue">
      <h2 id="session-queue-heading" className="text-sm font-medium text-ink">
        {SESSION_COPY.queueTitle}
      </h2>
      <ol className="mt-2 space-y-1">
        {items.map((item) => (
          <li
            key={item.exerciseId}
            className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm"
            data-testid={item.current ? 'session-queue-current' : 'session-queue-item'}
          >
            <span className="text-ink">{item.name}</span>
            <span className="text-xs text-ink-muted">
              {item.current ? SESSION_COPY.queueNow : item.held ? SESSION_COPY.queueHeld : null}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="min-h-12"
          onClick={onSkip}
          disabled={busy}
          aria-label={SESSION_COPY.skipExerciseAria}
          aria-describedby="session-skip-help"
          data-testid="session-skip"
        >
          {SESSION_COPY.skipExercise}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="min-h-12"
          onClick={onHold}
          disabled={busy}
          aria-label={SESSION_COPY.holdExerciseAria}
          aria-describedby="session-hold-help"
          data-testid="session-hold"
        >
          {SESSION_COPY.holdExercise}
        </Button>
      </div>
      <p id="session-skip-help" className="sr-only">
        {SESSION_COPY.skipExerciseAria}
      </p>
      <p id="session-hold-help" className="sr-only">
        {SESSION_COPY.holdExerciseAria}
      </p>
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert" data-testid="session-queue-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
