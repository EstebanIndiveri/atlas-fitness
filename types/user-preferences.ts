import type { ONBOARDING_COPY } from '@/lib/copy/onboarding';

type OnboardingSelectableStep = (typeof ONBOARDING_COPY.steps)[number];
type OnboardingOptionId<StepId extends OnboardingSelectableStep['id']> = Extract<
  OnboardingSelectableStep,
  { id: StepId }
>['options'][number]['id'];

export type UserGoalPreference = OnboardingOptionId<'goal'>;
export type UserPacePreference = OnboardingOptionId<'pace'>;
export type UserEquipmentPreference = OnboardingOptionId<'equipment'>;

export interface UserPreferences {
  goal: UserGoalPreference | null;
  pace: UserPacePreference | null;
  equipment: UserEquipmentPreference | null;
}
