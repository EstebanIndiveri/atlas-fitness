'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TipCard } from '@/components/TipCard';
import { StreakChip } from '@/components/StreakChip';
import { TelegramLinkBanner } from '@/components/TelegramLinkBanner';
import { InstallBanner } from '@/components/pwa/InstallBanner';
import { PageContainer } from '@/components/shell/PageContainer';
import { Card } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import { parseActiveWorkoutResponse } from '@/lib/workouts/parse-active-workout-response';
import type { AuthUser } from '@/types/auth';
import type { Workout } from '@/lib/db/schema';

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, activeRes, historyRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/workouts/active'),
          fetch('/api/workouts'),
        ]);

        if (!userRes.ok) {
          setLoading(false);
          return;
        }

        const userData = await userRes.json();
        setUser(userData);

        const activeBody: unknown = activeRes.ok ? await activeRes.json() : null;
        setActiveWorkout(parseActiveWorkoutResponse(activeRes.ok, activeBody));

        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setRecentWorkouts(historyData.slice(0, 5));
        }
      } catch {
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleNewWorkout = async () => {
    try {
      const response = await fetch('/api/workouts', { method: 'POST' });
      if (response.ok) {
        const workout = await response.json();
        router.push(`/dashboard/workout/${workout.id}`);
      }
    } catch (error) {
      console.error('Error creating workout:', error);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!user) {
    return null;
  }

  return (
    <PageContainer>
      <div className="mb-5">
        <h1 className="text-title font-bold text-ink">{UI_COPY.greeting(user.name)}</h1>
        <p className="mt-1 text-sm text-ink-muted sm:text-base" data-testid="welcome-message">
          {UI_COPY.welcome(user.name)}
        </p>
      </div>

      <StreakChip />

      <InstallBanner />

      {!user.telegramUserId && <TelegramLinkBanner />}

      <TipCard activeWorkout={activeWorkout} onStartWorkout={handleNewWorkout} />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink sm:text-xl">Historial Reciente</h2>
          <Link href="/dashboard/history" className="text-sm font-medium text-brand hover:underline">
            Ver todo
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <EmptyState
            title={UI_COPY.emptyWorkoutsTitle}
            description={UI_COPY.emptyWorkoutsBody}
          />
        ) : (
          <div className="space-y-3">
            {recentWorkouts.map((workout) => (
              <Link
                key={workout.id}
                href={`/dashboard/workout/${workout.id}`}
                className="block rounded-md border border-line p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand hover:bg-canvas"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {new Date(workout.startedAt).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    {workout.note && (
                      <p className="mt-1 text-xs text-ink-muted">{workout.note}</p>
                    )}
                  </div>
                  {workout.mood && (
                    <div className="text-xl" aria-label={`Estado de ánimo: ${workout.mood}`}>
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
    </PageContainer>
  );
}
