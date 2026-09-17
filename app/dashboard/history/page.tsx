'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-4 bg-gray-50">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Volver al Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h1 className="text-2xl font-bold mb-6">Historial de Entrenamientos</h1>

          {workouts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No tienes entrenamientos registrados aún.</p>
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Iniciar tu primer entrenamiento
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {workouts.map((workout) => (
                <Link
                  key={workout.id}
                  href={`/dashboard/workout/${workout.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  data-testid="workout-history-item"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-semibold text-lg">
                          {new Date(workout.startedAt).toLocaleDateString('es-AR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                        {!workout.endedAt && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
                            Activa
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
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
                        <p className="text-sm text-gray-700 mt-2 italic">&ldquo;{workout.note}&rdquo;</p>
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
        </div>
      </div>
    </main>
  );
}
