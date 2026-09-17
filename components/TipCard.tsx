'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
    const fetchTip = async () => {
      try {
        const response = await fetch('/api/tips/today');
        if (!response.ok) {
          throw new Error('Error al cargar el tip del día');
        }
        const data = await response.json();
        setTip(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchTip();
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
        throw new Error('Failed to save mood');
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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-blue-200 rounded w-1/4 mb-3"></div>
          <div className="h-6 bg-blue-200 rounded w-3/4 mb-4"></div>
          <div className="h-10 bg-blue-300 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
        <p className="text-red-800 text-sm">{error}</p>
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
    <div
      className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 mb-6"
      data-testid="tip-card"
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-blue-900 mb-2">💡 Consejo del día</h2>
        <p className="text-base text-gray-800 leading-relaxed" data-testid="tip-body">
          {tip.body}
        </p>
      </div>

      <div className="mb-4">
        <p className="text-xs text-gray-600 mb-2">¿Cómo te sentís hoy?</p>
        <div className="flex gap-2 justify-center">
          {moodEmojis.map(({ value, emoji, label }) => (
            <button
              key={value}
              onClick={() => handleMoodSelect(value)}
              disabled={savingMood}
              className={`text-2xl p-2 rounded-lg transition-all ${
                mood === value
                  ? 'bg-blue-200 scale-110'
                  : 'hover:bg-blue-100 hover:scale-105'
              } ${savingMood ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label={label}
              title={label}
              data-testid={`mood-${value}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {activeWorkout ? (
          <Link
            href={`/dashboard/workout/${activeWorkout.id}`}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-center text-sm"
            data-testid="continue-workout-cta"
          >
            Continuar Entrenamiento
          </Link>
        ) : (
          <button
            onClick={onStartWorkout}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-center text-sm"
            data-testid="new-workout-button"
          >
            Empezar Entreno
          </button>
        )}
      </div>
    </div>
  );
}
