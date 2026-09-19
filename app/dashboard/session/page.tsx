'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RoutinePicker } from '@/components/session/RoutinePicker';
import { PageContainer } from '@/components/shell/PageContainer';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { SESSION_COPY } from '@/lib/copy/session';
import { parseActiveWorkoutResponse } from '@/lib/workouts/parse-active-workout-response';
import type { Workout } from '@/lib/db/schema';
import type { RoutineSummary } from '@/types/routine';

export default function GuidedSessionPickerPage() {
  const router = useRouter();
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [active, setActive] = useState<Workout | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [routinesRes, activeRes] = await Promise.all([
          fetch('/api/routines'),
          fetch('/api/workouts/active'),
        ]);
        if (!routinesRes.ok) {
          throw new Error('routines');
        }
        setRoutines((await routinesRes.json()) as RoutineSummary[]);
        const activeBody: unknown = activeRes.ok ? await activeRes.json() : null;
        setActive(parseActiveWorkoutResponse(activeRes.ok, activeBody));
      } catch {
        setError(SESSION_COPY.errorLoad);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const startRoutine = async (routineId: number) => {
    setStartingId(routineId);
    try {
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routineId }),
      });
      if (!response.ok) {
        throw new Error('start');
      }
      const workout = (await response.json()) as { id: number };
      router.push(`/dashboard/session/${workout.id}`);
    } catch {
      setError(SESSION_COPY.errorLoad);
      setStartingId(null);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <h1 className="text-title font-bold text-ink">{SESSION_COPY.pickTitle}</h1>
      <p className="mt-1 mb-4 text-sm text-ink-muted">{SESSION_COPY.pickSubtitle}</p>
      {error ? <ErrorState message={error} /> : null}
      <RoutinePicker
        routines={routines}
        startingId={startingId}
        onStart={(id) => void startRoutine(id)}
        activeWorkoutId={active?.id ?? null}
        activeIsGuided={Boolean(active?.routineId)}
      />
    </PageContainer>
  );
}
