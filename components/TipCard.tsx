'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { cn } from '@/lib/ui/cn';
import type { DailyTip } from '@/lib/db/schema';
import type { Workout } from '@/lib/db/schema';

interface TipCardProps {
  activeWorkout: Workout | null;
  onStartWorkout?: () => void;
}

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
      // Keep the mood selected in UI even if save fails
    } finally {
      setSavingMood(false);
    }
  };

  if (loading) {
    return (
      <Card tone="brand" className="mb-6">
        <LoadingState compact />
      </Card>
    );
  }

  if (error) {
    return (
      <div className="mb-6">
        <ErrorState message={error} />
      </div>
    );
  }

  if (!tip) {
    return null;
  }

  const moodEmojis = [
    { value: 1, emoji: '😞', label: 'Mal' },
    { value: 2, emoji: '😕', label: 'Regular' },
    { value: 3, emoji: '😐', label: 'Normal' },
    { value: 4, emoji: '😊', label: 'Bien' },
    { value: 5, emoji: '😄', label: 'Excelente' },
  ];

  return (
    <Card tone="brand" className="mb-6" data-testid="tip-card">
      <div className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">💡 Consejo del día</h2>
        <p className="text-base leading-relaxed text-ink" data-testid="tip-body">
          {tip.body}
        </p>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs text-ink-muted">¿Cómo te sentís hoy?</p>
        <div className="flex justify-center gap-2">
          {moodEmojis.map(({ value, emoji, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleMoodSelect(value)}
              disabled={savingMood}
              className={cn(
                'rounded-lg p-2 text-2xl',
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
        {activeWorkout ? (
          <Link
            href={`/dashboard/workout/${activeWorkout.id}`}
            className={buttonClassName({ variant: 'success', className: 'flex-1 text-center' })}
            data-testid="continue-workout-cta"
          >
            Continuar Entrenamiento
          </Link>
        ) : (
          <Button
            onClick={onStartWorkout}
            className="flex-1"
            data-testid="new-workout-button"
          >
            Empezar Entreno
          </Button>
        )}
      </div>
    </Card>
  );
}
