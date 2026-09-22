'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageContainer } from '@/components/shell/PageContainer';
import { InstallToast } from '@/components/pwa/InstallToast';
import { CoachAtlasCard } from '@/components/today/CoachAtlasCard';
import { MoodEnergyCheckIn } from '@/components/today/MoodEnergyCheckIn';
import { TodayHabitsCard } from '@/components/today/TodayHabitsCard';
import { TodayHeader } from '@/components/today/TodayHeader';
import { TodayWeekCard } from '@/components/today/TodayWeekCard';
import { TodayWorkoutHero } from '@/components/today/TodayWorkoutHero';
import { LoadingState } from '@/components/ui/states';
import { useToday } from '@/hooks/useToday';
import { isOnboardingDone } from '@/lib/onboarding/state';

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
  const { today } = useToday();
  const [userName, setUserName] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [onboardingDone] = useState(() => isOnboardingDone() || isOnboardingDone());

  useEffect(() => {
    // Read the live store value (not the hydration snapshot) so already-onboarded
    // users are never bounced to the wizard on a hard load/refresh, where the
    // server snapshot (false) briefly precedes the client snapshot (true).
    if (!isOnboardingDone()) {
      router.replace('/onboarding');
    }
  }, [router]);

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

  if (!onboardingDone || userLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer className="space-y-6">
      <TodayHeader name={userName} />
      <MoodEnergyCheckIn />
      <TodayWorkoutHero
        onStartWorkout={handleStartWorkout}
        onAdapt={handleAdapt}
        onCreatePlan={handleCreatePlan}
      />
      <CoachAtlasCard routineId={routineId} />
      <TodayHabitsCard />
      <TodayWeekCard />
      <InstallToast />
    </PageContainer>
  );
}
