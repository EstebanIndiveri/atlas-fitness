'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageContainer } from '@/components/shell/PageContainer';
import { InstallToast } from '@/components/pwa/InstallToast';
import { CoachAtlasCard } from '@/components/today/CoachAtlasCard';
import type { CheckInAvailability, TodayAvailability } from '@/components/today/CoachAtlasCard';
import { MoodEnergyCheckIn, type MoodEnergyCheckInState } from '@/components/today/MoodEnergyCheckIn';
import { TodayHabitsCard } from '@/components/today/TodayHabitsCard';
import { TodayHeader } from '@/components/today/TodayHeader';
import { TodayWeekCard } from '@/components/today/TodayWeekCard';
import { TodayWorkoutHero } from '@/components/today/TodayWorkoutHero';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useToday } from '@/hooks/useToday';
import { isCheckInEnergy, isCheckInMood } from '@/lib/api/checkin';
import { getServerOnboardingState } from '@/lib/onboarding/client';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readUserName(value: unknown): string | null {
  return isRecord(value) && typeof value.name === 'string' ? value.name : null;
}

function readWorkoutId(value: unknown): number | null {
  return isRecord(value) && typeof value.id === 'number' ? value.id : null;
}

/**
 * Today screen (`/dashboard/today`): greeting, check-in, workout hero, Coach Atlas,
 * habits and weekly progress. Composes existing data hooks and honest empty states;
 * no fabricated metrics (DATA HONESTY RULE).
 * @returns The composed Today page.
 */
export default function TodayPage() {
  const router = useRouter();
  const { today, loading: todayLoading, error: todayError } = useToday();
  const [userName, setUserName] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingRetry, setOnboardingRetry] = useState(0);
  const [checkInState, setCheckInState] = useState<MoodEnergyCheckInState>({
    checkin: null,
    loading: true,
    saving: false,
    error: null,
  });
  useEffect(() => {
    const controller = new AbortController();

    async function loadOnboardingState(): Promise<void> {
      setOnboardingError(null);
      try {
        const state = await getServerOnboardingState(controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setOnboardingCompleted(state.completed);
        if (!state.completed) {
          router.replace('/onboarding');
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setOnboardingError(
            error instanceof Error ? error.message : 'No se pudo cargar el onboarding.',
          );
        }
      }
    }

    void loadOnboardingState();
    return () => controller.abort();
  }, [onboardingRetry, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadUser(): Promise<void> {
      try {
        const response = await fetch('/api/auth/me');
        if (!cancelled && response.ok) {
          const body: unknown = await response.json();
          setUserName(readUserName(body));
        }
      } catch (error) {
        console.error('Today: failed to load user profile', error);
      } finally {
        if (!cancelled) {
          setUserLoading(false);
        }
      }
    }

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const routineId = today?.kind === 'workout' ? today.routineId : null;
  const todayAvailability: TodayAvailability = todayLoading
    ? 'loading'
    : todayError
      ? 'error'
      : routineId === null
        ? 'empty'
        : 'ready';
  const dailyCheckIn = checkInState.checkin;
  const checkInContext = dailyCheckIn !== null
    && Number.isInteger(dailyCheckIn.id)
    && dailyCheckIn.id > 0
    && isCheckInEnergy(dailyCheckIn.energy)
    && isCheckInMood(dailyCheckIn.mood)
    ? {
        dailyCheckInId: dailyCheckIn.id,
        mood: dailyCheckIn.mood,
        energy: dailyCheckIn.energy,
      }
    : null;
  const checkInAvailability: CheckInAvailability = checkInState.loading
    ? 'loading'
    : checkInState.error
      ? 'error'
      : checkInState.saving
        ? 'saving'
      : checkInContext !== null
        ? 'ready'
        : 'missing';
  const handleCheckInStateChange = useCallback((state: MoodEnergyCheckInState): void => {
    setCheckInState(state);
  }, []);

  const handleStartWorkout = useCallback(async (): Promise<void> => {
    if (routineId === null) {
      return;
    }
    try {
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routineId }),
      });
      if (!response.ok) {
        return;
      }
      const workoutId = readWorkoutId(await response.json());
      if (workoutId !== null) {
        router.push(`/dashboard/session/${workoutId}`);
      }
    } catch (error) {
      console.error('Today: failed to start scheduled workout', error);
    }
  }, [routineId, router]);

  const handleAdapt = useCallback(() => {
    if (today?.kind !== 'workout' || !Number.isInteger(today.routineId) || today.routineId <= 0) {
      return;
    }
    router.push(
      `/dashboard/session/adapt?routineId=${today.routineId}&routineName=${encodeURIComponent(today.routineName)}&planGoal=${encodeURIComponent(today.planGoal ?? '')}`,
    );
  }, [router, today]);

  const handleCreatePlan = useCallback(() => {
    router.push('/dashboard/plan/new');
  }, [router]);

  if (onboardingError) {
    return (
      <PageContainer className="space-y-4">
        <ErrorState message={onboardingError} />
        <Button onClick={() => setOnboardingRetry((retry) => retry + 1)}>
          Reintentar
        </Button>
      </PageContainer>
    );
  }

  if (onboardingCompleted !== true || userLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer className="space-y-6">
      <TodayHeader name={userName} />
      <MoodEnergyCheckIn onStateChange={handleCheckInStateChange} />
      <TodayWorkoutHero
        onStartWorkout={handleStartWorkout}
        onAdapt={handleAdapt}
        onCreatePlan={handleCreatePlan}
      />
      <CoachAtlasCard
        routineId={routineId}
        todayAvailability={todayAvailability}
        todayError={todayError}
        checkInAvailability={checkInAvailability}
        checkInError={checkInState.error}
        checkInContext={checkInContext}
      />
      <TodayHabitsCard />
      <TodayWeekCard />
      <InstallToast />
    </PageContainer>
  );
}
