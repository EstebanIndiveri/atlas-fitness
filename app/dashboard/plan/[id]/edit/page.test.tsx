/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
let mockParamsId = '77';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: mockParamsId }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useRoutineList', () => ({
  useRoutineList: () => ({
    routines: [
      {
        id: 10,
        slug: 'empuje',
        name: 'Empuje',
        description: null,
        kind: 'gym',
        restSeconds: 90,
        isSystem: false,
        exercises: [],
      },
    ],
    loading: false,
    error: null,
  }),
}));

const mockUseEditableTrainingPlan = jest.fn();
const mockUsePlanBuilder = jest.fn();

jest.mock('@/hooks/usePlanBuilder', () => ({
  useEditableTrainingPlan: (planId: number | undefined) => mockUseEditableTrainingPlan(planId),
  usePlanBuilder: (...args: unknown[]) => mockUsePlanBuilder(...args),
}));

describe('EditPlanPage', () => {
  beforeEach(() => {
    mockParamsId = '77';
    jest.clearAllMocks();
  });

  it('renders a not-found empty state for an unavailable plan', async () => {
    mockUseEditableTrainingPlan.mockReturnValue({ plan: null, loading: false, error: null, notFound: true });
    mockUsePlanBuilder.mockReturnValue({});
    const { default: EditPlanPage } = await import('./page');

    render(<EditPlanPage />);

    expect(screen.getByText('Plan no encontrado')).toBeTruthy();
    expect(screen.getByText('No existe o no está disponible para tu cuenta.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Crear un plan' }).getAttribute('href')).toBe(
      '/dashboard/plan/new',
    );
  });

  it('loads the plan and renders the builder in edit mode', async () => {
    const loadedPlan = {
      plan: {
        id: 77,
        userId: 1,
        name: 'Semana actual',
        goal: null,
        isActive: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        deletedAt: null,
      },
      schedule: [],
    };
    mockUseEditableTrainingPlan.mockReturnValue({
      plan: loadedPlan,
      loading: false,
      error: null,
      notFound: false,
    });
    const submit = jest.fn(async () => true);
    mockUsePlanBuilder.mockReturnValue({
      name: 'Semana actual',
      goal: '',
      assignments: {
        0: { routineId: null, note: '' },
        1: { routineId: null, note: '' },
        2: { routineId: null, note: '' },
        3: { routineId: null, note: '' },
        4: { routineId: null, note: '' },
        5: { routineId: null, note: '' },
        6: { routineId: null, note: '' },
      },
      selectedCount: 0,
      canSubmit: true,
      submitting: false,
      error: null,
      setName: jest.fn(),
      setGoal: jest.fn(),
      setDayRoutine: jest.fn(),
      setDayNote: jest.fn(),
      submit,
    });
    const { default: EditPlanPage } = await import('./page');

    render(<EditPlanPage />);

    expect(mockUsePlanBuilder).toHaveBeenCalledWith(expect.any(Array), {
      mode: 'edit',
      initialPlan: loadedPlan,
    });
    expect(screen.getByRole('heading', { name: 'Editar plan semanal' })).toBeTruthy();
    expect(screen.getByText('Actualizá los días, las rutinas y el objetivo de tu semana.')).toBeTruthy();
    expect(screen.getByTestId('plan-submit').textContent).toBe('Guardar cambios');
    expect(screen.getByRole('link', { name: 'Volver al plan' }).getAttribute('href')).toBe(
      '/dashboard/plan/77',
    );

    fireEvent.click(screen.getByTestId('plan-submit'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/plan/77'));
  });

  it('treats partially numeric route params as not found', async () => {
    mockParamsId = '77abc';
    mockUseEditableTrainingPlan.mockReturnValue({ plan: null, loading: false, error: null, notFound: true });
    mockUsePlanBuilder.mockReturnValue({});
    const { default: EditPlanPage } = await import('./page');

    render(<EditPlanPage />);

    expect(mockUseEditableTrainingPlan).toHaveBeenCalledWith(undefined);
    expect(screen.getByText('Plan no encontrado')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Crear un plan' }).getAttribute('href')).toBe(
      '/dashboard/plan/new',
    );
  });
});
