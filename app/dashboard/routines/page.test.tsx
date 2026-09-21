/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { useRoutineList as useRoutineListHook } from '@/hooks/useRoutineList';
import type { RoutineSummary } from '@/types/routine';

jest.mock('@/hooks/useRoutineList', () => ({ useRoutineList: jest.fn() }));

const routine: RoutineSummary = {
  id: 1,
  slug: 'fuerza-base',
  name: 'Fuerza base',
  description: 'Rutina para probar CTAs.',
  kind: 'gym',
  restSeconds: 90,
  isSystem: false,
  exercises: [
    {
      id: 10,
      routineId: 1,
      exerciseId: 100,
      sortOrder: 0,
      targetSets: 3,
      targetReps: 8,
      exerciseName: 'Sentadilla',
      muscleGroup: 'Piernas',
      instructions: 'Bajá controlado.',
      imageUrl: null,
      videoUrl: null,
    },
  ],
};

describe('RoutinesPage', () => {
  it('renders distinct Coach Atlas and manual creation entry points', async () => {
    const { useRoutineList } = await import('@/hooks/useRoutineList');
    jest.mocked(useRoutineList as typeof useRoutineListHook).mockReturnValue({
      routines: [routine],
      loading: false,
      error: null,
      deletingId: null,
      reload: jest.fn<() => void>(),
      remove: jest.fn<(id: number) => Promise<boolean>>(),
    });
    const { default: RoutinesPage } = await import('./page');

    render(<RoutinesPage />);

    const coachCta = screen.getByTestId('routine-create-coach-cta');
    const manualCta = screen.getByTestId('routine-create-cta');

    expect(coachCta.getAttribute('href')).toBe('/dashboard/routines/coach');
    expect(coachCta.textContent).toBe('✦ Crear con Coach Atlas');
    expect(coachCta.className).toContain('bg-brand');
    expect(manualCta.getAttribute('href')).toBe('/dashboard/routines/new');
    expect(manualCta.textContent).toBe('Crear manual');
    expect(manualCta.className).toContain('ring-line');
  });
});
