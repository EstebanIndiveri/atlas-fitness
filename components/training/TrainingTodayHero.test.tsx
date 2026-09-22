/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import type { TodayResponse } from '@/lib/api/today';

import { TrainingTodayHero } from './TrainingTodayHero';
import type { RoutineSummary } from '@/types/routine';

function workoutToday(overrides: Partial<Extract<TodayResponse, { kind: 'workout' }>> = {}): TodayResponse {
  return {
    kind: 'workout',
    localDate: '2026-09-20',
    dayOfWeek: 0,
    trainingPlanId: 1,
    scheduledRoutineId: 2,
    routineId: 12,
    routineName: 'Torso fuerte',
    planGoal: 'Fuerza',
    dayReason: 'Pecho y espalda con foco técnico',
    completion: { completed: 0, total: 4 },
    ...overrides,
  };
}

function routine(overrides: Partial<RoutineSummary> = {}): RoutineSummary {
  return {
    id: 12,
    slug: 'torso-fuerte',
    name: 'Torso fuerte',
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

describe('TrainingTodayHero', () => {
  it('renders a workout with honest exercise and series metrics without fabricated minutes', () => {
    const onStart = jest.fn();

    render(
      <TrainingTodayHero
        today={workoutToday()}
        routines={[routine()]}
        activeWorkout={null}
        starting={null}
        onStart={onStart}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Torso fuerte' })).toBeTruthy();
    expect(screen.getByText('Fuerza')).toBeTruthy();
    expect(screen.getByText('Pecho y espalda con foco técnico')).toBeTruthy();
    expect(screen.getByText('2 ejercicios')).toBeTruthy();
    expect(screen.getByText('7 series')).toBeTruthy();
    expect(screen.queryByText(/min/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Empezar entrenamiento ▶' }));
    expect(onStart).toHaveBeenCalledWith(12);
    expect(screen.getByRole('link', { name: 'Ver detalles' }).getAttribute('href')).toBe(
      '/dashboard/routines/12',
    );
    expect(screen.getByRole('link', { name: 'Adaptar con Coach Atlas' }).getAttribute('href')).toBe(
      '/dashboard/session/adapt?routineId=12&routineName=Torso+fuerte&planGoal=Fuerza',
    );
  });

  it('omits routine metrics when routine detail data is unavailable', () => {
    render(
      <TrainingTodayHero
        today={workoutToday({ completion: { completed: 0, total: 4 } })}
        routines={[]}
        activeWorkout={null}
        starting={null}
        onStart={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Torso fuerte' })).toBeTruthy();
    expect(screen.queryByText('4 ejercicios')).toBeNull();
    expect(screen.queryByText(/series/)).toBeNull();
  });

  it('disables starting when an active guided workout exists', () => {
    render(
      <TrainingTodayHero
        today={workoutToday()}
        routines={[routine()]}
        activeWorkout={{ id: 55, routineId: 12 }}
        starting={null}
        onStart={jest.fn()}
      />,
    );

    expect(screen.getByTestId('continue-active-session').getAttribute('href')).toBe(
      '/dashboard/session/55',
    );
    expect(screen.getByRole('button', { name: 'Empezar entrenamiento ▶' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('renders rest, no-plan, and missing-routine states without numeric metrics', () => {
    const { rerender } = render(
      <TrainingTodayHero
        today={{ kind: 'rest_day', localDate: '2026-09-20', dayOfWeek: 0, trainingPlanId: 1, planGoal: null }}
        routines={[]}
        activeWorkout={null}
        starting={null}
        onStart={jest.fn()}
      />,
    );
    expect(screen.getByText('Descanso programado')).toBeTruthy();
    expect(screen.queryByText(/\d+\s/)).toBeNull();

    rerender(
      <TrainingTodayHero
        today={{ kind: 'no_plan', localDate: '2026-09-20', dayOfWeek: 0 }}
        routines={[]}
        activeWorkout={null}
        starting={null}
        onStart={jest.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: 'Crear una rutina' }).getAttribute('href')).toBe(
      '/dashboard/routines/new',
    );

    rerender(
      <TrainingTodayHero
        today={{
          kind: 'routine_missing',
          localDate: '2026-09-20',
          dayOfWeek: 0,
          trainingPlanId: 1,
          scheduledRoutineId: 2,
          routineId: 99,
          planGoal: null,
          dayReason: null,
        }}
        routines={[]}
        activeWorkout={null}
        starting={null}
        onStart={jest.fn()}
      />,
    );
    expect(screen.getByText('La rutina programada ya no está disponible.')).toBeTruthy();
  });
});
