'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { GuidedExerciseCard } from '@/components/session/GuidedExerciseCard';
import { RestTimer } from '@/components/session/RestTimer';
import { SessionCloseScreen } from '@/components/session/SessionCloseScreen';
import { PageContainer } from '@/components/shell/PageContainer';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useGuidedSession } from '@/hooks/useGuidedSession';
import { useRestTimer } from '@/hooks/useRestTimer';
import { SESSION_COPY } from '@/lib/copy/session';

export default function GuidedSessionPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const workoutId = String(params.workoutId ?? '');
  const session = useGuidedSession(workoutId);
  const rest = useRestTimer();
  const [motivator, setMotivator] = useState<string>(SESSION_COPY.motivators[0]);

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
    await session.saveAndClose();
    router.push('/dashboard');
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

  return (
    <PageContainer>
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm font-medium text-brand hover:underline">
          ← Volver
        </Link>
        <h1 className="mt-2 text-xl font-bold text-ink">{session.routine.name}</h1>
      </div>

      {showClose ? (
        <SessionCloseScreen
          summary={session.summary}
          mood={session.mood}
          onMood={session.setMood}
          onSave={() => void handleSaveAndClose()}
          saving={session.busy || ended}
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
            <GuidedExerciseCard
              exercise={session.current}
              completedCount={session.completedCount}
              weight={session.weight}
              onWeightChange={session.setWeight}
              onCompleteSet={() => void handleCompleteSet()}
              busy={session.busy || rest.active}
            />
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
