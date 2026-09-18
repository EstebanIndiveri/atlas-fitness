'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import type { Workout } from '@/lib/db/schema';

export default function WorkoutHistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const response = await fetch('/api/workouts');
        if (response.ok) {
          const data = await response.json();
          setWorkouts(data);
        }
      } catch (error) {
        console.error('Error fetching workouts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:py-6">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm font-medium text-brand hover:underline">
          ← Volver al Dashboard
        </Link>
      </div>

      <Card>
        <h1 className="mb-6 text-2xl font-bold text-ink">Historial de Entrenamientos</h1>

        {workouts.length === 0 ? (
          <EmptyState
            title={UI_COPY.emptyWorkoutsTitle}
            description={UI_COPY.emptyWorkoutsBody}
            action={
              <Link href="/dashboard" className={buttonClassName({ variant: 'primary' })}>
                {UI_COPY.startFirstWorkout}
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {workouts.map((workout) => (
              <Link
                key={workout.id}
                href={`/dashboard/workout/${workout.id}`}
                className="block rounded-lg border border-line p-4 hover:bg-canvas"
                data-testid="workout-history-item"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <p className="text-lg font-semibold text-ink">
                        {new Date(workout.startedAt).toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                      {!workout.endedAt && (
                        <span className="rounded-md bg-brand-muted px-2 py-1 text-xs font-medium text-ink">
                          Activa
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ink-muted">
                      {new Date(workout.startedAt).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {workout.endedAt && (
                        <>
                          {' - '}
                          {new Date(workout.endedAt).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </>
                      )}
                    </p>
                    {workout.note && (
                      <p className="mt-2 text-sm italic text-ink">&ldquo;{workout.note}&rdquo;</p>
                    )}
                  </div>
                  {workout.mood && (
                    <div className="text-2xl" aria-label={`Estado de ánimo: ${workout.mood}`}>
                      {workout.mood === 5 && '😄'}
                      {workout.mood === 4 && '😊'}
                      {workout.mood === 3 && '😐'}
                      {workout.mood === 2 && '😕'}
                      {workout.mood === 1 && '😞'}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
