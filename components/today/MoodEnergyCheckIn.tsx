'use client';

import { useRef, useState, type JSX, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MoodFace } from '@/components/today/MoodFace';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';
import { cn } from '@/lib/ui/cn';
import type { CheckInEnergy, DailyCheckInResponse } from '@/lib/api/checkin';

const CHECKIN_COPY = {
  title: '¿Cómo te sentís hoy?',
  moodGroupLabel: 'Estado de ánimo de hoy',
  energyTitle: 'Energía de hoy',
  noEnergy: 'Sin registrar energía',
  chooseMoodFirst: 'Elegí tu ánimo primero',
  helper: 'Atlas usa tu check-in como contexto para sus recomendaciones.',
} as const;

const ENERGY_OPTIONS: { value: CheckInEnergy; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
];
const MOOD_OPTIONS = [
  { value: 5, label: 'Excelente' },
  { value: 4, label: 'Con energía' },
  { value: 3, label: 'Normal' },
  { value: 1, label: 'Agotado' },
] as const;
const MOOD_VALUES: number[] = MOOD_OPTIONS.map(({ value }) => value);

function toCheckInEnergy(energy: DailyCheckInResponse['energy'] | null | undefined): CheckInEnergy | null {
  if (energy === 'low' || energy === 'medium' || energy === 'high') return energy;
  return null;
}

function labelForEnergy(energy: CheckInEnergy | null): string {
  const label = ENERGY_OPTIONS.find((option) => option.value === energy)?.label;
  return label ? `⚡ ${label} energía` : `⚡ ${CHECKIN_COPY.noEnergy}`;
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
export function MoodEnergyCheckIn(): JSX.Element {
  const { checkin, loading, saving, error, submit } = useDailyCheckin();
  const moodButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [selectedMood, setSelectedMood] = useState<number | null>(checkin?.mood ?? null);
  const [selectedEnergy, setSelectedEnergy] = useState<CheckInEnergy | null>(toCheckInEnergy(checkin?.energy));
  const [moodFirstHint, setMoodFirstHint] = useState(false);
  const [syncedCheckin, setSyncedCheckin] = useState(checkin);

  if (checkin !== syncedCheckin) {
    setSyncedCheckin(checkin);
    setSelectedMood(checkin?.mood ?? null);
    setSelectedEnergy(toCheckInEnergy(checkin?.energy));
  }

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
    <Card className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6" data-testid="mood-energy-checkin">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">{CHECKIN_COPY.title}</h2>
        <p className="pt-0.5 text-right text-sm font-semibold text-brand">{labelForEnergy(selectedEnergy)}</p>
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
            {MOOD_OPTIONS.map(({ value, label }) => {
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
                    'relative flex min-h-20 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    active
                      ? 'border-brand bg-brand text-white ring-2 ring-brand/30'
                      : 'border-line bg-canvas hover:border-brand hover:bg-surface',
                    saving && 'cursor-not-allowed',
                  )}
                  data-testid={`mood-${value}`}
                >
                  <MoodFace value={value} className={active ? 'text-white' : 'text-ink-muted'} />
                  <span className={cn('text-[0.68rem] font-medium leading-tight', active ? 'text-white' : 'text-ink')}>
                    {label}
                  </span>
                  {active ? (
                    <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ink text-[0.65rem] font-bold text-white" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-ink">{CHECKIN_COPY.energyTitle}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2" aria-label={CHECKIN_COPY.energyTitle}>
            {ENERGY_OPTIONS.map(({ value, label }) => {
              const active = selectedEnergy === value;
              return (
                <Button
                  key={value}
                  variant={active ? 'primary' : 'ghost'}
                  size="sm"
                  aria-pressed={active}
                  aria-label={`Seleccionar energía ${label}`}
                  disabled={saving}
                  onClick={() => handleEnergySelect(value)}
                  className={cn(
                    'rounded-xl border py-2.5 transition focus-visible:outline-brand',
                    active ? 'border-brand text-white' : 'border-line bg-canvas text-ink-muted hover:bg-surface',
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
