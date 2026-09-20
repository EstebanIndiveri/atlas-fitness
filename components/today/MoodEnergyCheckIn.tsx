'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';
import { MOOD_EMOJIS } from '@/lib/copy/session';
import { cn } from '@/lib/ui/cn';
import type { CheckInEnergy, DailyCheckInResponse } from '@/lib/api/checkin';

const CHECKIN_COPY = {
  title: 'Estado de ánimo',
  autosaveHint: 'Auto-guarda al tocar',
  moodGroupLabel: 'Estado de ánimo de hoy',
  energyTitle: 'Nivel de energía',
  noEnergy: 'Sin registrar',
  chooseMoodFirst: 'Elegí tu ánimo primero',
  helper: 'Atlas usa tu check-in como contexto para sus recomendaciones.',
} as const;

const ENERGY_OPTIONS: { value: CheckInEnergy; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
];
const MOOD_VALUES: number[] = MOOD_EMOJIS.map(({ value }) => value);

function toCheckInEnergy(energy: DailyCheckInResponse['energy'] | null | undefined): CheckInEnergy | null {
  if (energy === 'low' || energy === 'medium' || energy === 'high') return energy;
  return null;
}

function labelForEnergy(energy: CheckInEnergy | null): string {
  return ENERGY_OPTIONS.find((option) => option.value === energy)?.label ?? CHECKIN_COPY.noEnergy;
}

function moodValueForKey(currentMood: number, key: string): number | null {
  const currentIndex = MOOD_VALUES.indexOf(currentMood);
  if (currentIndex === -1) return null;

  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return MOOD_VALUES[(currentIndex + 1) % MOOD_VALUES.length] ?? null;
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return MOOD_VALUES[(currentIndex - 1 + MOOD_VALUES.length) % MOOD_VALUES.length] ?? null;
  }
  if (key === 'Home') {
    return MOOD_VALUES[0] ?? null;
  }
  if (key === 'End') {
    return MOOD_VALUES[MOOD_VALUES.length - 1] ?? null;
  }

  return null;
}

/**
 * Renders the wired daily mood and energy check-in card for the Hoy screen.
 *
 * @returns A mobile-first card that auto-saves user mood and energy selections.
 * @example
 * <MoodEnergyCheckIn />
 */
export function MoodEnergyCheckIn() {
  const { checkin, loading, saving, error, submit } = useDailyCheckin();
  const moodButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [selectedMood, setSelectedMood] = useState<number | null>(checkin?.mood ?? null);
  const [selectedEnergy, setSelectedEnergy] = useState<CheckInEnergy | null>(toCheckInEnergy(checkin?.energy));
  const [moodFirstHint, setMoodFirstHint] = useState(false);

  useEffect(() => {
    setSelectedMood(checkin?.mood ?? null);
    setSelectedEnergy(toCheckInEnergy(checkin?.energy));
  }, [checkin]);

  const handleMoodSelect = (mood: number): void => {
    if (saving) return;

    const energy = selectedEnergy ?? toCheckInEnergy(checkin?.energy);
    setSelectedMood(mood);
    setMoodFirstHint(false);
    void submit({ mood, energy });
  };

  const handleMoodKeyDown = (mood: number, event: KeyboardEvent<HTMLButtonElement>): void => {
    const nextMood = moodValueForKey(mood, event.key);
    if (nextMood === null) return;

    event.preventDefault();
    moodButtonRefs.current[nextMood]?.focus();
    handleMoodSelect(nextMood);
  };

  const handleEnergySelect = (energy: CheckInEnergy): void => {
    if (saving) return;

    const mood = selectedMood ?? checkin?.mood ?? null;
    if (mood === null) {
      setMoodFirstHint(true);
      return;
    }

    setSelectedEnergy(energy);
    setMoodFirstHint(false);
    void submit({ mood, energy });
  };

  return (
    <Card className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6" data-testid="mood-energy-checkin">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-ink">{CHECKIN_COPY.title}</h2>
        <p className="pt-0.5 text-right text-xs font-medium text-ink-muted">
          {CHECKIN_COPY.autosaveHint}
        </p>
      </div>

      {loading ? <LoadingState compact /> : null}
      {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

      {!loading ? (
        <>
          <div
            className={cn('mt-5 flex justify-between gap-2', saving && 'opacity-70')}
            role="radiogroup"
            aria-label={CHECKIN_COPY.moodGroupLabel}
          >
            {MOOD_EMOJIS.map(({ value, emoji, label }) => {
              const active = selectedMood === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={label}
                  tabIndex={active || (selectedMood === null && value === MOOD_VALUES[0]) ? 0 : -1}
                  disabled={saving}
                  ref={(element) => {
                    moodButtonRefs.current[value] = element;
                  }}
                  onClick={() => handleMoodSelect(value)}
                  onKeyDown={(event) => handleMoodKeyDown(value, event)}
                  className={cn(
                    'relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-canvas px-2 py-3 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    active ? 'border-brand bg-brand-muted ring-2 ring-brand' : 'hover:border-brand hover:bg-surface',
                    saving && 'cursor-not-allowed',
                  )}
                  data-testid={`mood-${value}`}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
                  <span className="text-[0.68rem] font-medium leading-tight text-ink">{label}</span>
                  {active ? (
                    <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-brand text-[0.65rem] font-bold text-white" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-ink">{CHECKIN_COPY.energyTitle}</p>
            <p className="text-sm font-semibold text-brand">{labelForEnergy(selectedEnergy)}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2" aria-label={CHECKIN_COPY.energyTitle}>
            {ENERGY_OPTIONS.map(({ value, label }) => {
              const active = selectedEnergy === value;
              return (
                <Button
                  key={value}
                  variant={active ? 'primary' : 'secondary'}
                  size="sm"
                  aria-pressed={active}
                  aria-label={`Seleccionar energía ${label}`}
                  disabled={saving}
                  onClick={() => handleEnergySelect(value)}
                  className={cn(
                    'rounded-xl border border-line py-2.5 transition focus-visible:outline-brand',
                    active ? 'border-brand bg-brand text-white' : 'bg-canvas text-ink-muted hover:bg-surface',
                  )}
                >
                  {label}
                </Button>
              );
            })}
          </div>
          {moodFirstHint ? <p className="mt-2 text-xs font-medium text-brand">{CHECKIN_COPY.chooseMoodFirst}</p> : null}
          <p className="mt-5 text-xs leading-relaxed text-ink-muted">{CHECKIN_COPY.helper}</p>
        </>
      ) : null}
    </Card>
  );
}
