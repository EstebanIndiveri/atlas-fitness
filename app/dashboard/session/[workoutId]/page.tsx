'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { GuidedExerciseCard } from '@/components/session/GuidedExerciseCard';
import { GuidedSessionHeader } from '@/components/session/GuidedSessionHeader';
import { RestTimer } from '@/components/session/RestTimer';
import { SessionCloseScreen } from '@/components/session/SessionCloseScreen';
import { SessionQueueActions } from '@/components/session/SessionQueueActions';
import { PageContainer } from '@/components/shell/PageContainer';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useGuidedSession } from '@/hooks/useGuidedSession';
import { useRestTimer } from '@/hooks/useRestTimer';
import { recordPostWorkoutFeedback } from '@/lib/api/post-workout-feedback';
import { SESSION_COPY } from '@/lib/copy/session';
import { isValidFeedback } from './feedback-validation';
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

  const handleCompleteSet = async () => {
    try {
      const result = await session.completeSet();
      if (!result) return;
      setMotivator(result.motivator);
      if (result.wentToClose) {
        return;
      }
      rest.start(session.routine?.restSeconds ?? 90);
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
      if (!session.workout.endedAt) {
        await session.saveAndClose();
      }
      await recordPostWorkoutFeedback({
        workoutId: session.workout.id,
        effort: selectedEffort,
        sensation: selectedSensation,
        discomfort,
        note: null,
      });
      router.push('/dashboard/today');
    } catch {
      setFeedbackError(SESSION_COPY.feedbackSaveError);
    } finally {
      setFeedbackSaving(false);
    }
  };

  const handleSkip = async () => {
    const ok = await session.skipCurrent();
    if (ok) {
      rest.skip();
    }
  };

  const handleHold = async () => {
    const ok = await session.holdCurrent();
    if (ok) {
      rest.skip();
    }
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

  return (
    <PageContainer>
      <GuidedSessionHeader
        routineName={session.routine.name}
        currentIndex={currentIndex}
        totalExercises={session.routine.exercises.length}
        muscleGroup={session.current?.muscleGroup ?? null}
      />

      {showClose ? (
        <SessionCloseScreen
          summary={session.summary}
          routineName={session.routine.name}
          muscleGroups={muscleGroups}
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
          {rest.active ? (
            <RestTimer remaining={rest.remaining} motivator={motivator} onSkip={rest.skip} />
          ) : null}

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
                exercise={session.current}
                completedCount={session.completedCount}
                weight={session.weight}
                onWeightChange={session.setWeight}
                onCompleteSet={() => void handleCompleteSet()}
                busy={session.busy || rest.active}
              />
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
    </PageContainer>
  );
}
