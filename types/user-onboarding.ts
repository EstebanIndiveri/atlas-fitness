/** Server-owned onboarding status for one authenticated account. */
export interface UserOnboardingState {
  completed: boolean;
}

/** Explicit Finish or Skip request accepted by the onboarding API. */
export type UserOnboardingAction =
  | { action: 'skip' }
  | {
      action: 'finish';
      answers: {
        goal: string | null;
        pace: string | null;
        equipment: string | null;
      };
    };
