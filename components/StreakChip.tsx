'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
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
      <Card className="mb-6 p-4" data-testid="streak-chip" aria-busy="true">
        <LoadingState compact />
      </Card>
    );
  }

  if (error || !streak) {
    return (
      <div className="mb-6" data-testid="streak-chip">
        <ErrorState message={error ?? 'No pudimos cargar tu racha'} />
      </div>
    );
  }

  return (
    <Card className="mb-6 p-4" data-testid="streak-chip">
      <p className="text-sm font-semibold text-ink">
        Racha actual:{' '}
        <span data-testid="current-streak">{streak.currentStreak}</span>{' '}
        {daysLabel(streak.currentStreak)}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        Mejor racha:{' '}
        <span data-testid="longest-streak">{streak.longestStreak}</span>{' '}
        {daysLabel(streak.longestStreak)}
      </p>
      {streak.currentStreak === 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Todavía no tenés racha. Entrená o registrá tu ánimo hoy.
        </p>
      )}
    </Card>
  );
}
