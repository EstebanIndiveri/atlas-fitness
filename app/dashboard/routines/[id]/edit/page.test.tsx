import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import EditRoutinePage from './page';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '404' }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/useRoutineEditor', () => ({
  useRoutineEditor: () => ({
    loading: false,
    notFound: true,
    draft: { name: '', description: '', kind: 'gym', restSeconds: 90, exercises: [] },
    catalog: [],
    selectedExerciseId: null,
    setSelectedExerciseId: jest.fn(),
    duplicateMessage: null,
    validation: { ok: true, items: {} },
    busy: false,
    error: null,
    readOnly: false,
    onMetaChange: jest.fn(),
    onAddExercise: jest.fn(),
    onUpdateExercise: jest.fn(),
    onMoveExercise: jest.fn(),
    onRemoveExercise: jest.fn(),
    save: jest.fn(),
  }),
}));

describe('EditRoutinePage', () => {
  it('renders the not-found empty state without leaking ownership', () => {
    render(<EditRoutinePage />);
    expect(screen.getByTestId(ROUTINE_TEST_IDS.notFound).textContent).toContain(ROUTINE_COPY.notFound);
    expect(screen.getByText(ROUTINE_COPY.notFoundBody)).toBeTruthy();
    expect(screen.queryByText(/userId/i)).toBeNull();
  });
});
