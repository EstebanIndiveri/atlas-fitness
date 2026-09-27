'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import {
  saveOnboardingAnswers,
  type OnboardingAnswers,
} from '@/lib/onboarding/state';
import { finishOnboarding, skipOnboarding } from '@/lib/onboarding/client';

const HOME_ROUTE = '/dashboard/today';

/**
 * First-run onboarding route (`/onboarding`): full-screen goal/pace/equipment wizard.
 * Persists the account's preferences and completion before routing to Hoy.
 * @returns The onboarding wizard page.
 */
export default function OnboardingPage() {
  const router = useRouter();

  const finish = useCallback(
    async (answers: OnboardingAnswers): Promise<void> => {
      saveOnboardingAnswers(answers);
      await finishOnboarding(answers);
      router.replace(HOME_ROUTE);
    },
    [router],
  );

  const skip = useCallback(async (): Promise<void> => {
    await skipOnboarding();
    router.replace(HOME_ROUTE);
  }, [router]);

  return <OnboardingWizard onFinish={finish} onSkip={skip} />;
}
