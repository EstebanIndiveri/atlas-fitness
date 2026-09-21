/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import type { RoutineSummary } from '@/types/routine';
import type { PlanDayState } from '@/hooks/usePlanBuilder';
import type { TrainingPlanDayOfWeek } from '@/lib/services/training-plan';
import { PLAN_COPY, PLAN_TEST_IDS } from '@/lib/copy/plan';
import { PlanBuilderForm } from './PlanBuilderForm';

function routine(id: number, name: string): RoutineSummary {
  return {
    id,
    slug: `r-${id}`,
    name,
    description: null,
    kind: 'gym',
    restSeconds: 90,
    isSystem: false,
    exercises: [],
  };
}

const routines: RoutineSummary[] = [routine(10, 'Empuje'), routine(20, 'Pierna')];

function baseProps() {
  const assignments: Record<TrainingPlanDayOfWeek, PlanDayState> = {
    0: { routineId: null, note: '' },
    1: { routineId: null, note: '' },
    2: { routineId: null, note: '' },
    3: { routineId: null, note: '' },
    4: { routineId: null, note: '' },
    5: { routineId: null, note: '' },
    6: { routineId: null, note: '' },
  };
  return {
    routines,
    name: '',
    goal: '',
    assignments,
    selectedCount: 0,
    canSubmit: false,
    submitting: false,
    error: null as string | null,
    onNameChange: jest.fn(),
    onGoalChange: jest.fn(),
    onDayRoutineChange: jest.fn(),
    onDayNoteChange: jest.fn(),
    onSubmit: jest.fn(),
  };
}

describe('PlanBuilderForm', () => {
  it('renders a routine select per weekday with a rest option and the user routines', () => {
    render(<PlanBuilderForm {...baseProps()} />);

    const mondaySelect = screen.getByTestId(PLAN_TEST_IDS.daySelect(1)) as HTMLSelectElement;
    const optionLabels = Array.from(mondaySelect.options).map((option) => option.textContent);
    expect(optionLabels).toEqual([PLAN_COPY.restOption, 'Empuje', 'Pierna']);
  });

  it('reports the selected routine id when a day changes', () => {
    const props = baseProps();
    render(<PlanBuilderForm {...props} />);

    fireEvent.change(screen.getByTestId(PLAN_TEST_IDS.daySelect(1)), { target: { value: '10' } });

    expect(props.onDayRoutineChange).toHaveBeenCalledWith(1, 10);
  });

  it('reports rest (null) when a day is set back to the rest option', () => {
    const props = baseProps();
    props.assignments[1] = { routineId: 10, note: '' };
    render(<PlanBuilderForm {...props} />);

    fireEvent.change(screen.getByTestId(PLAN_TEST_IDS.daySelect(1)), { target: { value: '' } });

    expect(props.onDayRoutineChange).toHaveBeenCalledWith(1, null);
  });

  it('only shows a note field for days with an assigned routine', () => {
    const props = baseProps();
    props.assignments[1] = { routineId: 10, note: '' };
    render(<PlanBuilderForm {...props} />);

    expect(screen.getByTestId(PLAN_TEST_IDS.dayNote(1))).toBeTruthy();
    expect(screen.queryByTestId(PLAN_TEST_IDS.dayNote(2))).toBeNull();
  });

  it('shows the summary count and disables submit until it can submit', () => {
    const props = baseProps();
    props.selectedCount = 2;
    render(<PlanBuilderForm {...props} />);

    expect(screen.getByTestId(PLAN_TEST_IDS.summary).textContent).toBe(PLAN_COPY.summary(2));
    expect((screen.getByTestId(PLAN_TEST_IDS.submit) as HTMLButtonElement).disabled).toBe(true);
  });

  it('submits when the form is valid', () => {
    const props = baseProps();
    props.canSubmit = true;
    render(<PlanBuilderForm {...props} />);

    fireEvent.submit(screen.getByTestId(PLAN_TEST_IDS.form));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders the API error when present', () => {
    const props = baseProps();
    props.error = 'No se pudo crear el plan. Probá de nuevo.';
    render(<PlanBuilderForm {...props} />);

    expect(screen.getByTestId(PLAN_TEST_IDS.error).textContent).toBe(
      'No se pudo crear el plan. Probá de nuevo.',
    );
  });
});
