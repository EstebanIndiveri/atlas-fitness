'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TipCard } from '@/components/TipCard';
import { StreakChip } from '@/components/StreakChip';
import { TelegramLinkBanner } from '@/components/TelegramLinkBanner';
import { InstallBanner } from '@/components/pwa/InstallBanner';
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

        if (activeRes.ok) {
          const activeData = await activeRes.json();
          setActiveWorkout(activeData);
        }

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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Cargando...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col p-4 sm:p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Atlas Fitness</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base" data-testid="welcome-message">
              Bienvenido, {user.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/settings"
              className="px-3 py-2 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
              data-testid="settings-link"
            >
              Ajustes
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-xs sm:text-sm bg-gray-200 hover:bg-gray-300 rounded-md"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <InstallBanner />

        {!user.telegramUserId && <TelegramLinkBanner />}

        <StreakChip />

        <TipCard activeWorkout={activeWorkout} onStartWorkout={handleNewWorkout} />

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Historial Reciente</h2>
            <Link
              href="/dashboard/history"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver todo
            </Link>
          </div>

          {recentWorkouts.length === 0 ? (
            <p className="text-gray-500 text-sm">No tienes entrenamientos registrados aún.</p>
          ) : (
            <div className="space-y-3">
              {recentWorkouts.map((workout) => (
                <Link
                  key={workout.id}
                  href={`/dashboard/workout/${workout.id}`}
                  className="block p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(workout.startedAt).toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                      {workout.note && (
                        <p className="text-xs text-gray-600 mt-1">{workout.note}</p>
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
        </div>
      </div>
    </main>
  );
}
