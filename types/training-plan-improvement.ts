import type { WeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';
import type { TrainingPlanHubDto } from '@/types/training-plan-hub';

export type TrainingPlanImprovementAssignment =
  | { kind: 'rest' }
  | { kind: 'unavailable' }
  | (Extract<
      TrainingPlanHubDto['days'][number]['assignment'],
      { kind: 'routine' }
    > & {
      exercises: Array<{
        exerciseId: number;
        exerciseName: string;
        targetSets: number;
        targetReps: number;
      }>;
    });

export interface TrainingPlanImprovementSnapshot {
  plan: TrainingPlanHubDto['plan'];
  days: Array<{
    dayOfWeek: TrainingPlanHubDto['days'][number]['dayOfWeek'];
    assignment: TrainingPlanImprovementAssignment;
  }>;
}

export interface TrainingPlanImprovementProposal {
  intent: string;
  currentPlan: TrainingPlanImprovementSnapshot;
  proposal: WeeklyPlanDraft;
  confirmationToken: string;
}

export interface ConfirmTrainingPlanImprovementInput {
  mutationId: string;
  intent: string;
  expectedPlanUpdatedAt: string;
  proposal: WeeklyPlanDraft;
  confirmationToken: string;
}
