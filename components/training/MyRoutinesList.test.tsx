/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import type { RoutineSummary } from '@/types/routine';

import { MyRoutinesList } from './MyRoutinesList';

function routine(overrides: Partial<RoutineSummary> = {}): RoutineSummary {
  return {
    id: 12,
    slug: 'torso',
    name: 'Torso',
    description: null,
    kind: 'gym',
    restSeconds: 90,
    isSystem: false,
    exercises: [
      {
        id: 1,
        routineId: 12,
        exerciseId: 101,
        sortOrder: 0,
        targetSets: 4,
        targetReps: 8,
        exerciseName: 'Press banca',
        muscleGroup: 'Pecho',
        instructions: 'Controlado.',
        imageUrl: null,
        videoUrl: null,
      },
      {
        id: 2,
        routineId: 12,
        exerciseId: 102,
        sortOrder: 1,
        targetSets: 3,
        targetReps: 10,
        exerciseName: 'Remo',
        muscleGroup: 'Espalda',
        instructions: 'Controlado.',
        imageUrl: null,
        videoUrl: null,
      },
    ],
    ...overrides,
  };
}

describe('MyRoutinesList', () => {
  it('renders routine exercise and set counts through real routine data', () => {
    const onStart = jest.fn();

    render(
      <MyRoutinesList
        routines={[routine()]}
        activeWorkout={null}
        starting={null}
        onStart={onStart}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Mis rutinas' })).toBeTruthy();
    expect(screen.getByText('Torso')).toBeTruthy();
    expect(screen.getByText('2 ejercicios')).toBeTruthy();
    expect(screen.getByText('7 series')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    expect(onStart).toHaveBeenCalledWith(12);
  });

  it('renders empty and active-workout states', () => {
    const { rerender } = render(
      <MyRoutinesList routines={[]} activeWorkout={null} starting={null} onStart={jest.fn()} />,
    );

    expect(screen.getByText('Todavía no tenés rutinas')).toBeTruthy();

    rerender(
      <MyRoutinesList
        routines={[routine()]}
        activeWorkout={{ id: 77, routineId: 12 }}
        starting={null}
        onStart={jest.fn()}
      />,
    );

    expect(screen.getByTestId('continue-active-session').getAttribute('href')).toBe(
      '/dashboard/session/77',
    );
    expect(screen.getByRole('button', { name: 'Iniciar' })).toHaveProperty('disabled', true);
  });
});
