'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TipCard } from '@/components/TipCard';
import { StreakChip } from '@/components/StreakChip';
import { TelegramLinkBanner } from '@/components/TelegramLinkBanner';
import { InstallBanner } from '@/components/pwa/InstallBanner';
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
    <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{UI_COPY.brand}</h1>
        <p className="mt-1 text-sm text-ink-muted sm:text-base" data-testid="welcome-message">
          Bienvenido, {user.name}
        </p>
      </div>

      <InstallBanner />

      {!user.telegramUserId && <TelegramLinkBanner />}

      <StreakChip />

      <TipCard activeWorkout={activeWorkout} onStartWorkout={handleNewWorkout} />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Historial Reciente</h2>
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
                className="block rounded-md border border-line p-3 hover:bg-canvas"
              >
                <div className="flex items-center justify-between">
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
    </div>
  );
}
