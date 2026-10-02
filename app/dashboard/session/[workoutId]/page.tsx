'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GuidedExerciseCard } from '@/components/session/GuidedExerciseCard';
import { GuidedSessionHeader } from '@/components/session/GuidedSessionHeader';
import { RestTimer } from '@/components/session/RestTimer';
import { SessionCloseScreen } from '@/components/session/SessionCloseScreen';
import { SessionQueueActions } from '@/components/session/SessionQueueActions';
import { VerifiedPrCelebration } from '@/components/session/VerifiedPrCelebration';
import { PageContainer } from '@/components/shell/PageContainer';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useGuidedSession } from '@/hooks/useGuidedSession';
import { useRestTimer } from '@/hooks/useRestTimer';
import { fetchExerciseProgression } from '@/lib/api/exercise-progression';
import { recordPostWorkoutFeedback } from '@/lib/api/post-workout-feedback';
import { deriveEligibleCohorts, findVerifiedClosePr } from '@/lib/session/close-pr';
import { hasPrEventBeenSeen, markPrEventSeen } from '@/lib/session/pr-event-guard';
import { SESSION_COPY } from '@/lib/copy/session';
import { isValidFeedback } from './feedback-validation';
import { evaluateCapture } from '@/lib/session/semantics-draft';
import type { VerifiedProgressionEvent } from '@/lib/session/close-pr';
import type { WorkoutSet } from '@/lib/db/schema';
import type {
  DiscomfortEntry,
  WorkoutSensation,
} from '@/lib/services/post-workout-feedback';

const moodToSensation: Record<number, WorkoutSensation> = {
  1: 'bad',
  2: 'hard',
  3: 'neutral',
  4: 'good',
  5: 'great',
};

function readStartedAt(workout: unknown): Date | null {
  if (!workout || typeof workout !== 'object' || !('startedAt' in workout)) {
    return null;
  }
  const value = workout.startedAt;
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function useElapsedSeconds(startedAt: Date | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!startedAt) {
    return 0;
  }
  return Math.max(0, Math.floor((now - startedAt.getTime()) / 1000));
}

interface ClosedWorkoutPayload {
  id: number;
  sets: WorkoutSet[];
}

/**
 * Best-effort, bounded PR verification for a workout that just closed locally.
 *
 * Only the server read model can classify a PR; this helper merely derives the
 * workout's own eligible cohorts, checks the full contract, and dedupes the
 * presentation event. Any failure yields `null` and never affects the close.
 */
async function detectVerifiedClosePr(
  workout: ClosedWorkoutPayload,
): Promise<VerifiedProgressionEvent | null> {
  const candidates = deriveEligibleCohorts(workout.sets);
  if (candidates.length === 0) {
    return null;
  }
  const closedSetIds = new Set(workout.sets.map((set) => set.id));
  const event = await findVerifiedClosePr({
    workoutId: workout.id,
    closedSetIds,
    candidates,
    fetchProgression: fetchExerciseProgression,
  });
  if (!event || hasPrEventBeenSeen(event.key)) {
    return null;
  }
  // Write the dedupe key BEFORE exposing the celebration (brief §19/E10).
  markPrEventSeen(event.key);
  return event;
}

export default function GuidedSessionPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const workoutId = String(params.workoutId ?? '');
  const session = useGuidedSession(workoutId);
  const rest = useRestTimer();
  const [motivator, setMotivator] = useState<string>(SESSION_COPY.motivators[0]);
  const [effort, setEffort] = useState<number | null>(null);
  const [sensation, setSensation] = useState<WorkoutSensation | null>(
    session.mood ? moodToSensation[session.mood] ?? null : null,
  );
  const [discomfort, setDiscomfort] = useState<DiscomfortEntry[]>([]);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [verifiedEvent, setVerifiedEvent] = useState<VerifiedProgressionEvent | null>(null);
  const [restTotalSeconds, setRestTotalSeconds] = useState(0);
  const elapsedSeconds = useElapsedSeconds(readStartedAt(session.workout ?? {}));

  const handleCompleteSet = async () => {
    try {
      const result = await session.completeSet();
      if (!result) return;
      setMotivator(result.motivator);
      if (result.wentToClose) {
        return;
      }
      const suggestedRest = session.routine?.restSeconds ?? 90;
      setRestTotalSeconds(suggestedRest);
      rest.start(suggestedRest);
    } catch {
      // error state lives in the hook when load fails; keep rest from starting
    }
  };

  const handleSaveAndClose = async () => {
    const selectedEffort = effort;
    const selectedSensation = sensation;
    if (
      !session.workout ||
      selectedSensation === null ||
      !isValidFeedback(selectedEffort, selectedSensation, discomfort)
    ) {
      setFeedbackError(SESSION_COPY.feedbackSaveError);
      return;
    }

    setFeedbackSaving(true);
    setFeedbackError(null);
    try {
      // Only a real local open → closed transition may become celebration-eligible.
      const wasOpen = !session.workout.endedAt;
      const closedWorkout = wasOpen ? await session.saveAndClose() : null;

      await recordPostWorkoutFeedback({
        workoutId: session.workout.id,
        effort: selectedEffort,
        sensation: selectedSensation,
        discomfort,
        note: null,
      });

      if (wasOpen && closedWorkout) {
        const event = await detectVerifiedClosePr(closedWorkout);
        if (event) {
          setVerifiedEvent(event);
          return;
        }
      }

      router.push('/dashboard/today');
    } catch {
      // Feedback is a separate persistence operation from the close: a failure
      // here must not rewrite the factual closed state.
      setFeedbackError(SESSION_COPY.feedbackSaveError);
    } finally {
      setFeedbackSaving(false);
    }
  };

  const handleContinueFromCelebration = () => {
    router.push('/dashboard/today');
  };

  const handleSkip = async () => {
    const ok = await session.skipCurrent();
    if (ok) {
      setRestTotalSeconds(0);
      rest.skip();
    }
  };

  const handleHold = async () => {
    const ok = await session.holdCurrent();
    if (ok) {
      setRestTotalSeconds(0);
      rest.skip();
    }
  };

  const handleAddRestThirtySeconds = () => {
    const nextRemaining = rest.remaining + 30;
    setRestTotalSeconds((currentTotal) => Math.max(currentTotal, rest.remaining) + 30);
    rest.start(nextRemaining);
  };

  if (session.loading) {
    return <LoadingState />;
  }

  if (session.error || !session.workout) {
    return (
      <PageContainer>
        <ErrorState message={SESSION_COPY.errorLoad} />
      </PageContainer>
    );
  }

  if (!session.routine) {
    return (
      <PageContainer>
        <p className="text-ink">
          <Link href={`/dashboard/workout/${session.workout.id}`} className="text-brand hover:underline">
            Continuar Entrenamiento
          </Link>
        </p>
      </PageContainer>
    );
  }

  const ended = Boolean(session.workout.endedAt);
  const showClose = session.phase === 'close' || ended;
  const currentExerciseIndex = session.current
    ? session.routine.exercises.findIndex(
        (exercise) => exercise.exerciseId === session.current?.exerciseId,
      )
    : -1;
  const currentIndex = currentExerciseIndex >= 0 ? currentExerciseIndex + 1 : null;
  const muscleGroups = Array.from(
    new Set(session.routine.exercises.map((exercise) => exercise.muscleGroup)),
  ).filter((muscleGroup) => muscleGroup.trim().length > 0);
  const completedSetsForCurrent = session.current
    ? session.workout.sets
        .filter((set) => set.exerciseId === session.current?.exerciseId)
        .map((set) => ({
          setIndex: set.setIndex,
          weightKg: set.weightKg,
          reps: set.reps,
          semanticCaptureVersion: set.semanticCaptureVersion,
          loadMode: set.loadMode,
          amountBasis: set.amountBasis,
          side: set.side,
          setPurpose: set.setPurpose,
          repCountBasis: set.repCountBasis,
        }))
    : [];
  const repsValue = Number.parseInt(session.reps, 10);
  const capture = session.current
    ? evaluateCapture(
        session.semanticDraft,
        session.weight,
        Number.isFinite(repsValue) && repsValue > 0 ? repsValue : session.current.targetReps,
      )
    : null;
  const canSubmitSet = capture?.ok === true;
  const nextExerciseName = session.queueItems.find((item) => !item.current)?.name ?? null;

  return (
    <PageContainer>
      <div
        className={!showClose ? 'pb-[calc(10rem+env(safe-area-inset-bottom,0px))]' : undefined}
        data-testid="guided-session-page"
      >
        <GuidedSessionHeader
          routineName={session.routine.name}
          currentIndex={currentIndex}
          totalExercises={session.routine.exercises.length}
          muscleGroup={session.current?.muscleGroup ?? null}
          elapsedSeconds={elapsedSeconds}
        />

        {verifiedEvent ? (
          <VerifiedPrCelebration
            event={verifiedEvent}
            onContinue={handleContinueFromCelebration}
          />
        ) : showClose ? (
          <SessionCloseScreen
            summary={session.summary}
            routineName={session.routine.name}
            muscleGroups={muscleGroups}
            closed={ended}
            effort={effort}
            onEffort={setEffort}
            sensation={sensation}
            onSensation={setSensation}
            discomfort={discomfort}
            onDiscomfortChange={setDiscomfort}
            mood={session.mood}
            onMood={session.setMood}
            onSave={() => void handleSaveAndClose()}
            saving={session.busy || feedbackSaving}
            error={feedbackError}
          />
        ) : (
          <>
            {session.suggestion?.nextExerciseId ? (
              <Card className="mb-4 p-4" data-testid="next-exercise-banner">
                <p className="text-sm font-medium text-ink">
                  {session.suggestion.isLast ? SESSION_COPY.lastExercise : SESSION_COPY.nextExercise}
                </p>
                <p className="text-sm text-ink-muted">{session.suggestion.message}</p>
              </Card>
            ) : null}

            {session.current ? (
              <>
                <GuidedExerciseCard
                  workoutId={session.workout.id}
                  exercise={session.current}
                  completedCount={session.completedCount}
                  completedSets={completedSetsForCurrent}
                  weight={session.weight}
                  onWeightChange={session.setWeight}
                  reps={session.reps}
                  onRepsChange={session.setReps}
                  onCompleteSet={() => void handleCompleteSet()}
                  onAddSet={session.addSet}
                  onReplace={() => void handleSkip()}
                  onHold={() => void handleHold()}
                  busy={session.busy || rest.active}
                  resting={rest.active}
                  nextExerciseName={nextExerciseName}
                  semantics={session.semantics}
                  canSubmitSet={canSubmitSet}
                />
                {rest.active ? (
                  <div
                    className="fixed inset-x-0 bottom-app-cta z-30 border-t border-line bg-canvas/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-card backdrop-blur md:sticky md:bottom-4 md:mx-auto md:max-w-4xl md:rounded-2xl md:border"
                    data-testid="rest-timer-bar"
                  >
                    <RestTimer
                      remaining={rest.remaining}
                      totalSeconds={restTotalSeconds || session.routine.restSeconds}
                      motivator={motivator}
                      onSkip={rest.skip}
                      onAddThirtySeconds={handleAddRestThirtySeconds}
                    />
                  </div>
                ) : null}
                <SessionQueueActions
                  items={session.queueItems}
                  onSkip={() => void handleSkip()}
                  onHold={() => void handleHold()}
                  busy={session.busy}
                  error={session.actionError}
                />
              </>
            ) : (
              <Card className="p-4">
                <p className="text-ink">{SESSION_COPY.lastExerciseDone}</p>
              </Card>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
