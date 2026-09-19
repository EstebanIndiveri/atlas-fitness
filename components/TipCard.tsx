'use client';

import { useState, useEffect } from 'react';
import { HabitCtas } from '@/components/habit/HabitCtas';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import { cn } from '@/lib/ui/cn';
import type { DailyTip, Workout } from '@/lib/db/schema';

interface TipCardProps {
  activeWorkout: Workout | null;
  onStartWorkout?: () => void;
}

const MOOD_EMOJIS = [
  { value: 1, emoji: '😞', label: 'Mal' },
  { value: 2, emoji: '😕', label: 'Regular' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '😊', label: 'Bien' },
  { value: 5, emoji: '😄', label: 'Excelente' },
] as const;

export function TipCard({ activeWorkout, onStartWorkout }: TipCardProps) {
  const [tip, setTip] = useState<DailyTip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [savingMood, setSavingMood] = useState(false);

  useEffect(() => {
    const fetchTipAndMood = async () => {
      try {
        const [tipResponse, moodResponse] = await Promise.all([
          fetch('/api/tips/today'),
          fetch('/api/mood'),
        ]);
        if (!tipResponse.ok) {
          throw new Error('Error al cargar el tip del día');
        }
        const data = await tipResponse.json();
        setTip(data);

        if (moodResponse.ok) {
          const checkin = await moodResponse.json();
          if (checkin && typeof checkin.mood === 'number') {
            setMood(checkin.mood);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchTipAndMood();
  }, []);

  const handleMoodSelect = async (selectedMood: number) => {
    if (savingMood) return;

    setMood(selectedMood);
    setSavingMood(true);

    try {
      const response = await fetch('/api/mood', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mood: selectedMood }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar el estado de ánimo');
      }
    } catch (err) {
      console.error('Error al guardar el estado de ánimo:', err);
    } finally {
      setSavingMood(false);
    }
  };

  return (
    <Card tone="brand" className="mb-6" data-testid="tip-card" aria-busy={loading}>
      {loading ? <LoadingState compact /> : null}
      {!loading && error ? <ErrorState message={error} /> : null}
      {!loading && !error && !tip ? (
        <EmptyState title={UI_COPY.emptyTipTitle} description={UI_COPY.emptyTipBody} />
      ) : null}
      {!loading && !error && tip ? (
        <div className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">💡 {UI_COPY.tipOfDay}</h2>
          <p className="text-base leading-relaxed text-ink" data-testid="tip-body">
            {tip.body}
          </p>
        </div>
      ) : null}

      <div className="mb-4">
        <p id="mood-today-label" className="mb-2 text-xs text-ink-muted">
          {UI_COPY.moodToday}
        </p>
        <div className="flex justify-center gap-2" role="group" aria-labelledby="mood-today-label">
          {MOOD_EMOJIS.map(({ value, emoji, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleMoodSelect(value)}
              disabled={savingMood}
              className={cn(
                'min-h-11 min-w-11 rounded-lg p-2 text-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                mood === value ? 'bg-surface ring-2 ring-brand' : 'hover:bg-surface',
                savingMood && 'cursor-not-allowed opacity-50',
              )}
              aria-label={label}
              aria-pressed={mood === value}
              title={label}
              data-testid={`mood-${value}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <HabitCtas activeWorkout={activeWorkout} onStartWorkout={onStartWorkout} />
      </div>
    </Card>
  );
}
