/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { TrainingPlanHubState } from '@/hooks/useTrainingPlanHub';
import type { TrainingPlanHubDto } from '@/types/training-plan-hub';
import type {
  ConfirmTrainingPlanImprovementInput,
  TrainingPlanImprovementProposal,
} from '@/types/training-plan-improvement';

const mockUseTrainingPlanHub = jest.fn<(planId: number) => TrainingPlanHubState>();
const mockGenerateProposal = jest.fn<
  (planId: number, intent: string) => Promise<TrainingPlanImprovementProposal>
>();
const mockConfirmProposal = jest.fn<
  (planId: number, input: ConfirmTrainingPlanImprovementInput) => Promise<number>
>();
const mockPush = jest.fn<(href: string) => void>();

jest.mock('@/hooks/useTrainingPlanHub', () => ({
  useTrainingPlanHub: (planId: number) => mockUseTrainingPlanHub(planId),
}));

jest.mock('@/lib/api/training-plan-improvement', () => ({
  generateTrainingPlanImprovement: mockGenerateProposal,
  confirmTrainingPlanImprovement: mockConfirmProposal,
  TrainingPlanImprovementClientError: class TrainingPlanImprovementClientError extends Error {
    kind: string;
    constructor(kind: string, message: string) {
      super(message);
      this.kind = kind;
    }
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const hub: TrainingPlanHubDto = {
  plan: {
    id: 11,
    name: 'Semana base',
    goal: 'Fuerza',
    isActive: true,
    updatedAt: '2026-09-25T10:00:00.000Z',
  },
  days: [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
    dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    assignment: dayOfWeek === 1
      ? {
          kind: 'routine',
          routineId: 4,
          routineName: 'Torso',
          routineDescription: 'Fuerza base',
          routineKind: 'gym',
          focus: 'Técnica',
        }
      : { kind: 'rest' },
  })),
};

const proposal: TrainingPlanImprovementProposal = {
  intent: 'Reducir volumen',
  confirmationToken: 'signed-proposal-receipt',
  currentPlan: {
    ...hub,
    days: hub.days.map(({ dayOfWeek, assignment }) => ({
      dayOfWeek,
      assignment: assignment.kind === 'routine'
        ? {
            ...assignment,
            exercises: [
              {
                exerciseId: 1,
                exerciseName: 'Press banca',
                targetSets: 4,
                targetReps: 6,
              },
            ],
          }
        : assignment,
    })),
  },
  proposal: {
    source: 'fallback',
    name: 'Coach Atlas · Reducir volumen',
    goal: 'Reducir volumen',
    days: [
      {
        dayOfWeek: 1,
        title: 'Día 1',
        focus: 'Fuerza técnica',
        exercises: [
          {
            exerciseId: 1,
            exerciseName: 'Press banca',
            muscleGroup: 'Pecho',
            sortOrder: 0,
            targetSets: 3,
            targetReps: 8,
          },
        ],
      },
    ],
  },
};

describe('TrainingPlanImprovement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTrainingPlanHub.mockReturnValue({ status: 'ready', data: hub, error: null });
    mockGenerateProposal.mockResolvedValue(proposal);
    mockConfirmProposal.mockResolvedValue(12);
  });

  it('shows a before/proposal diff and cancellation never calls the save endpoint', async () => {
    const { TrainingPlanImprovement } = await import('./TrainingPlanImprovement');
    render(<TrainingPlanImprovement planId={11} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Qué querés mejorar' }), {
      target: { value: 'Reducir volumen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar propuesta' }));

    expect(await screen.findByRole('heading', { name: 'ANTES' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'PROPUESTA' })).toBeTruthy();
    expect(screen.getByText('Torso')).toBeTruthy();
    expect(screen.getByText('Press banca · 4 × 6')).toBeTruthy();
    expect(screen.getByText('Press banca · 3 × 8')).toBeTruthy();
    expect(mockGenerateProposal).toHaveBeenCalledWith(11, 'Reducir volumen');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar propuesta' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generar propuesta' })).toBeTruthy();
    });
    expect(mockConfirmProposal).not.toHaveBeenCalled();
  });

  it('requires a separate explicit confirmation before saving and then opens the new plan', async () => {
    const { TrainingPlanImprovement } = await import('./TrainingPlanImprovement');
    render(<TrainingPlanImprovement planId={11} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Qué querés mejorar' }), {
      target: { value: 'Reducir volumen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar propuesta' }));
    await screen.findByRole('heading', { name: 'PROPUESTA' });

    const confirmButton = screen.getByRole('button', { name: 'Guardar y reemplazar plan' });
    expect(confirmButton.hasAttribute('disabled')).toBe(true);
    expect(mockConfirmProposal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo reemplazar/i }));
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockConfirmProposal).toHaveBeenCalledWith(
        11,
        expect.objectContaining({
          intent: 'Reducir volumen',
          expectedPlanUpdatedAt: hub.plan.updatedAt,
          confirmationToken: proposal.confirmationToken,
          proposal: proposal.proposal,
        }),
      );
      expect(mockPush).toHaveBeenCalledWith('/dashboard/plan/12');
    });
  });

  it('keeps the proposal available after a failed save so the user can retry', async () => {
    mockConfirmProposal.mockRejectedValue(new Error('No se pudo guardar el plan.'));
    const { TrainingPlanImprovement } = await import('./TrainingPlanImprovement');
    render(<TrainingPlanImprovement planId={11} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Qué querés mejorar' }), {
      target: { value: 'Reducir volumen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar propuesta' }));
    await screen.findByRole('heading', { name: 'PROPUESTA' });
    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo reemplazar/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y reemplazar plan' }));

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo guardar el plan.');
    expect(screen.getByRole('heading', { name: 'PROPUESTA' })).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
