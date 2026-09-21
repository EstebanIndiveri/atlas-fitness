import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { GuidedExerciseCard } from './GuidedExerciseCard';
import { SESSION_COPY } from '@/lib/copy/session';
import type { RoutineExerciseItem } from '@/types/routine';

function exercise(overrides: Partial<RoutineExerciseItem> = {}): RoutineExerciseItem {
  return {
    id: 1,
    routineId: 1,
    exerciseId: 10,
    sortOrder: 0,
    targetSets: 3,
    targetReps: 8,
    exerciseName: 'Press Banca',
    muscleGroup: 'Pecho',
    instructions: 'Bajá la barra con control.',
    imageUrl: null,
    videoUrl: null,
    ...overrides,
  };
}

const cardProps = {
  completedCount: 0,
  weight: '40',
  onWeightChange: jest.fn(),
  onCompleteSet: jest.fn(),
  busy: false,
};

describe('GuidedExerciseCard', () => {
  it('keeps guided-exercise-image visible when imageUrl is null', () => {
    render(<GuidedExerciseCard exercise={exercise({ imageUrl: null })} {...cardProps} />);

    const media = screen.getByTestId('guided-exercise-image');
    expect(media.tagName).not.toBe('IMG');
    expect(media.getAttribute('role')).toBe('img');
    expect(media.getAttribute('aria-label')).toBe('Press Banca');
    expect(media.textContent).toBe(SESSION_COPY.noImage);
  });

  it('keeps guided-exercise-image visible when imageUrl is empty', () => {
    render(<GuidedExerciseCard exercise={exercise({ imageUrl: '   ' })} {...cardProps} />);

    const media = screen.getByTestId('guided-exercise-image');
    expect(media.tagName).not.toBe('IMG');
    expect(media.textContent).toBe(SESSION_COPY.noImage);
  });

  it('renders a real image when imageUrl is present', () => {
    render(
      <GuidedExerciseCard
        exercise={exercise({ imageUrl: 'https://cdn.example/bench.png' })}
        {...cardProps}
      />,
    );

    const media = screen.getByTestId('guided-exercise-image');
    expect(media.tagName).toBe('IMG');
    expect(media.getAttribute('src')).toBe('https://cdn.example/bench.png');
    expect(media.getAttribute('alt')).toBe('Press Banca');
  });

  it('shows completed set progress using real current counts', () => {
    render(
      <GuidedExerciseCard
        exercise={exercise({ targetSets: 3, targetReps: 8 })}
        {...cardProps}
        completedCount={1}
        completedSets={[{ setIndex: 1, weightKg: '70.0', reps: 10 }]}
      />,
    );

    expect(screen.getByText('Serie 2 de 3')).toBeTruthy();
    expect(screen.getByText('70.0')).toBeTruthy();
  });

  it('renders Figma exercise metadata and disabled honest action chips', () => {
    render(
      <GuidedExerciseCard
        exercise={exercise({
          targetSets: 4,
          targetReps: 6,
          exerciseName: 'Press de banca con barra',
          muscleGroup: 'Pecho y tríceps',
        })}
        {...cardProps}
        completedCount={2}
        completedSets={[
          { setIndex: 1, weightKg: '70.0', reps: 10 },
          { setIndex: 2, weightKg: '75.0', reps: 8 },
        ]}
      />,
    );

    expect(screen.getByText('Pecho y tríceps')).toBeTruthy();
    expect(screen.getByText('Serie 3 de 4')).toBeTruthy();
    expect(screen.getByText('Press de banca con barra')).toBeTruthy();
    expect(screen.queryByText('Ejercicio compuesto')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Técnica no disponible en esta versión' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Reemplazar ejercicio desde los controles de cola' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Notas no disponibles en esta versión' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
