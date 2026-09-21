'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import {
  markOnboardingDone,
  saveOnboardingAnswers,
  type OnboardingAnswers,
} from '@/lib/onboarding/state';

const HOME_ROUTE = '/dashboard/today';

/**
 * First-run onboarding route (`/onboarding`): full-screen goal/pace/equipment wizard.
 * Persists answers and the completion marker, then routes to Hoy.
 * @returns The onboarding wizard page.
 */
export default function OnboardingPage() {
  const router = useRouter();

  const finish = useCallback(
    (answers: OnboardingAnswers): void => {
      saveOnboardingAnswers(answers);
      markOnboardingDone();
      router.replace(HOME_ROUTE);
    },
    [router],
  );

  const skip = useCallback((): void => {
    markOnboardingDone();
    router.replace(HOME_ROUTE);
  }, [router]);

  return <OnboardingWizard onFinish={finish} onSkip={skip} />;
}
