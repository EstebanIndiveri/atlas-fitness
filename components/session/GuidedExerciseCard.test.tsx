import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
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
  reps: '8',
  onRepsChange: jest.fn(),
  onCompleteSet: jest.fn(),
  busy: false,
};

describe('GuidedExerciseCard', () => {
  it('keeps guided-exercise-image visible when imageUrl is null', () => {
    render(<GuidedExerciseCard exercise={exercise({ imageUrl: null })} {...cardProps} />);

    expect(screen.queryByTestId('guided-exercise-image')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar técnica' }));

    const media = screen.getByTestId('guided-exercise-image');
    expect(media.tagName).not.toBe('IMG');
    expect(media.getAttribute('role')).toBe('img');
    expect(media.getAttribute('aria-label')).toBe('Press Banca');
    expect(media.textContent).toBe(SESSION_COPY.noImage);
  });

  it('keeps guided-exercise-image visible when imageUrl is empty', () => {
    render(<GuidedExerciseCard exercise={exercise({ imageUrl: '   ' })} {...cardProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar técnica' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar técnica' }));

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

  it('renders Figma exercise metadata and functional exclusive action chips', () => {
    const onReplace = jest.fn();
    const onHold = jest.fn();
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
        onReplace={onReplace}
        onHold={onHold}
      />,
    );

    expect(screen.getByText('Pecho y tríceps')).toBeTruthy();
    expect(screen.getByText('Serie 3 de 4')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Press de banca con barra' })).toBeTruthy();
    expect(screen.queryByText(/Ejercicio compuesto/)).toBeNull();
    expect(screen.queryByText(/Última vez/)).toBeNull();
    expect(screen.queryByText('RPE 8.5')).toBeNull();
    expect(screen.queryByTestId('guided-exercise-image')).toBeNull();

    const technique = screen.getByRole('button', { name: 'Mostrar técnica' });
    const replace = screen.getByRole('button', { name: 'Mostrar reemplazo' });
    const notes = screen.getByRole('button', { name: 'Mostrar notas' });

    expect((technique as HTMLButtonElement).disabled).toBe(false);
    expect(technique.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(technique);
    expect(technique.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('guided-exercise-image')).toBeTruthy();

    fireEvent.click(notes);
    expect(technique.getAttribute('aria-pressed')).toBe('false');
    expect(notes.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('guided-exercise-image')).toBeNull();
    expect(screen.getByPlaceholderText('Sin notas cargadas para este ejercicio.')).toBeTruthy();

    fireEvent.click(replace);
    expect(notes.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Saltar este ejercicio')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Saltar este ejercicio y pasar al siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Posponer este ejercicio para más adelante. Conservamos las series ya hechas.' }));
    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it('lets the user type a session-local note from the Notas panel', () => {
    render(<GuidedExerciseCard exercise={exercise()} {...cardProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar notas' }));

    const notes = screen.getByLabelText('Nota de la sesión para Press Banca') as HTMLTextAreaElement;
    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes.maxLength).toBe(280);
    expect(notes.placeholder).toBe('Sin notas cargadas para este ejercicio.');

    fireEvent.change(notes, { target: { value: 'Subir a 42.5 kg si sale liviano.' } });

    expect(notes.value).toBe('Subir a 42.5 kg si sale liviano.');
  });

  it('renders the rest timer immediately after the set table instead of above it', () => {
    render(
      <GuidedExerciseCard
        exercise={exercise()}
        {...cardProps}
        focusSlot={<div data-testid="rest-timer">01:30</div>}
      />,
    );

    const card = screen.getByTestId('guided-exercise-card');
    expect(card.contains(screen.getByTestId('rest-timer'))).toBe(true);
    expect(card.textContent?.indexOf('SERIE 1 EN CURSO')).toBeLessThan(
      card.textContent?.indexOf('01:30') ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it('renders the complete-set action as a fixed bottom CTA outside the table flow', () => {
    render(
      <GuidedExerciseCard
        exercise={exercise()}
        {...cardProps}
        nextExerciseName="Press militar con mancuernas"
      />,
    );

    const complete = screen.getByTestId('complete-set-button');
    const bar = screen.getByTestId('complete-set-bar');
    expect(complete.textContent).toContain('COMPLETAR SERIE 1');
    expect(bar.className).toContain('fixed');
    expect(bar.className).toContain('bottom-app-cta');
    expect(bar.textContent).toContain('Siguiente: Press militar con mancuernas');
    expect(screen.getByTestId('set-checklist').contains(complete)).toBe(false);
  });
});
