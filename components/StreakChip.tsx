'use client';

import { useEffect, useState } from 'react';
import type { StreakStats } from '@/types/streak';

function daysLabel(count: number): string {
  return count === 1 ? 'día' : 'días';
}

export function StreakChip() {
  const [streak, setStreak] = useState<StreakStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const response = await fetch('/api/stats/streak');
        if (!response.ok) {
          throw new Error('Error al cargar la racha');
        }
        const data = (await response.json()) as StreakStats;
        setStreak(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    void fetchStreak();
  }, []);

  if (loading) {
    return (
      <div
        className="bg-white rounded-lg shadow-md p-4 mb-6"
        data-testid="streak-chip"
        aria-busy="true"
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !streak) {
    return (
      <div
        className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
        data-testid="streak-chip"
      >
        <p className="text-red-800 text-sm">{error ?? 'No pudimos cargar tu racha'}</p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-lg shadow-md p-4 mb-6"
      data-testid="streak-chip"
    >
      <p className="text-sm font-semibold text-gray-900">
        Racha actual:{' '}
        <span data-testid="current-streak">{streak.currentStreak}</span>{' '}
        {daysLabel(streak.currentStreak)}
      </p>
      <p className="text-sm text-gray-600 mt-1">
        Mejor racha:{' '}
        <span data-testid="longest-streak">{streak.longestStreak}</span>{' '}
        {daysLabel(streak.longestStreak)}
      </p>
      {streak.currentStreak === 0 && (
        <p className="text-xs text-gray-500 mt-2">
          Todavía no tenés racha. Entrená o registrá tu ánimo hoy.
        </p>
      )}
    </div>
  );
}
