import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GuidedExerciseCard } from './GuidedExerciseCard';
import { PROGRESSION_COPY } from '@/lib/copy/exercise-progression';
import { SESSION_COPY } from '@/lib/copy/session';
import type { ExerciseSessionContext } from '@/types/exercise-session-memory';
import type { RoutineExerciseItem } from '@/types/routine';
import type { SessionSemanticsControls } from '@/lib/session/semantics-draft';

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

const emptyContext: ExerciseSessionContext = {
  workoutId: 1,
  exerciseId: 10,
  currentNote: null,
  lastCompletedSets: null,
  lastCompletedNote: null,
};

const originalFetch = global.fetch;

function mockContextFetch(context: ExerciseSessionContext = emptyContext): void {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(context),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  // Pending by default so unrelated tests do not flush async state updates.
  global.fetch = jest.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const cardProps = {
  workoutId: 1,
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
    expect(screen.getByText(/70\.0/)).toBeTruthy();
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
    expect(screen.getByRole('button', { name: SESSION_COPY.showLastTime })).toBeTruthy();
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
    expect(screen.getByPlaceholderText(SESSION_COPY.notesPlaceholder)).toBeTruthy();

    fireEvent.click(replace);
    expect(notes.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Saltar este ejercicio')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Saltar este ejercicio y pasar al siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Posponer este ejercicio para más adelante. Conservamos las series ya hechas.' }));
    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it('persists the note from the Notas panel with explicit save and no native maxLength', async () => {
    mockContextFetch();
    render(<GuidedExerciseCard exercise={exercise()} {...cardProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar notas' }));

    const notes = (await screen.findByLabelText(
      'Nota de la sesión para Press Banca',
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(notes.readOnly).toBe(false));
    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes.getAttribute('maxlength')).toBeNull();
    expect(notes.placeholder).toBe(SESSION_COPY.notesPlaceholder);
    expect(screen.getByRole('button', { name: SESSION_COPY.notesSave })).toBeTruthy();

    fireEvent.change(notes, { target: { value: 'Subir a 42.5 kg si sale liviano.' } });

    expect(notes.value).toBe('Subir a 42.5 kg si sale liviano.');
  });

  it('shows the honest empty state in the Última vez panel', async () => {
    mockContextFetch();
    render(<GuidedExerciseCard exercise={exercise()} {...cardProps} />);

    fireEvent.click(screen.getByRole('button', { name: SESSION_COPY.showLastTime }));

    expect(await screen.findByText(SESSION_COPY.lastTimeEmpty)).toBeTruthy();
    expect(screen.queryByTestId('last-time-set')).toBeNull();
  });

  it('keeps set logging usable when the context request fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    render(<GuidedExerciseCard exercise={exercise()} {...cardProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar notas' }));

    expect(await screen.findByText(SESSION_COPY.notesLoadError)).toBeTruthy();
    expect(screen.getByTestId('set-checklist')).toBeTruthy();
    expect(screen.getByTestId('complete-set-button')).toBeTruthy();
  });

  it('keeps the exercise card free of rest-timer UI', () => {
    render(<GuidedExerciseCard exercise={exercise()} {...cardProps} />);

    expect(screen.queryByTestId('rest-timer')).toBeNull();
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
    expect(screen.getByTestId('complete-set-icon').tagName).toBe('svg');
    expect(screen.getByTestId('complete-set-icon').getAttribute('viewBox')).toBe('0 0 24 24');
    expect(screen.getByTestId('complete-set-icon').getAttribute('aria-hidden')).toBe('true');
    expect(complete.className).toContain('bg-brand');
    expect(complete.getAttribute('aria-label')).toBe('Completar serie 1');
    expect(bar.className).toContain('fixed');
    expect(bar.className).toContain('bottom-app-cta');
    expect(bar.textContent).toContain('Siguiente: Press militar con mancuernas');
    expect(screen.getByTestId('set-checklist').contains(complete)).toBe(false);
  });

  it('hides the complete-set bar while the fixed rest timer is active', () => {
    render(
      <GuidedExerciseCard
        exercise={exercise()}
        {...cardProps}
        resting
      />,
    );

    expect(screen.queryByTestId('complete-set-bar')).toBeNull();
  });

  it('migrates session action glyphs to governed decorative icons without losing labels', () => {
    render(<GuidedExerciseCard exercise={exercise()} {...cardProps} />);

    const labels = [
      'Mostrar técnica',
      'Mostrar reemplazo',
      'Mostrar notas',
      SESSION_COPY.showLastTime,
      PROGRESSION_COPY.showAria,
    ];

    for (const label of labels) {
      const chip = screen.getByRole('button', { name: label });
      const icon = chip.querySelector('svg');
      expect(icon).not.toBeNull();
      expect(icon?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(chip.textContent ?? '').not.toMatch(/[◎⇄≣↺▸]/);
      expect(chip.getAttribute('aria-label')).toBe(label);
      expect(chip.getAttribute('aria-pressed')).toBe('false');
    }
  });

  describe('comparable progression', () => {
    function semanticsWith(
      draft: Partial<SessionSemanticsControls['draft']> = {},
    ): SessionSemanticsControls {
      return {
        draft: {
          loadMode: 'external',
          amountBasis: 'total',
          side: 'bilateral',
          setPurpose: 'working',
          repCountBasis: '',
          ...draft,
        },
        reused: false,
        onLoadMode: jest.fn(),
        onAmountBasis: jest.fn(),
        onSide: jest.fn(),
        onSetPurpose: jest.fn(),
        onRepCountBasis: jest.fn(),
      };
    }

    const READY = {
      metricId: 'same_reps_external_load',
      progressionRuleVersion: 1,
      readStatus: 'ready',
      cohort: {
        exerciseId: 10,
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        reps: 8,
      },
      currentRepresentative: {
        setId: 11,
        workoutId: 5,
        setIndex: 1,
        reps: 8,
        weightKg: '80',
        endedAt: '2026-09-20T12:00:00.000Z',
        localDate: '2026-09-20',
        semantics: {
          semanticCaptureVersion: 1,
          loadMode: 'external',
          amountBasis: 'total',
          side: 'bilateral',
          setPurpose: 'working',
          repCountBasis: null,
        },
        provenance: 'user_input',
      },
      previousComparableRepresentative: null,
      currentBest: null,
      comparison: 'new_pr',
      reasons: ['eligible'],
      history: { items: [], nextCursor: null, limit: 10, bounded: true },
      provenance: 'atlas_computed',
    };

    function routedFetch(progression: unknown) {
      return jest.fn(async (input: Parameters<typeof fetch>[0]) => {
        const url = String(input);
        if (url.includes('/progression')) {
          return { ok: true, status: 200, text: async () => JSON.stringify(progression) } as Response;
        }
        return { ok: true, status: 200, text: async () => JSON.stringify(emptyContext) } as Response;
      });
    }

    it('loads the comparable card for a valid external cohort', async () => {
      const mock = routedFetch(READY);
      global.fetch = mock as unknown as typeof fetch;

      render(
        <GuidedExerciseCard exercise={exercise()} {...cardProps} semantics={semanticsWith()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: PROGRESSION_COPY.showAria }));

      expect(await screen.findByTestId('progression-ready')).toBeTruthy();
      expect(screen.getByTestId('progression-conclusion').textContent).toContain(
        PROGRESSION_COPY.comparison.new_pr,
      );
      const urls = mock.mock.calls.map(([url]) => String(url));
      expect(urls.some((url) => url === '/api/exercises/10/progression?reps=8&amountBasis=total&side=bilateral')).toBe(
        true,
      );
    });

    it.each([
      ['bodyweight', { loadMode: 'bodyweight' as const, amountBasis: '' as const }],
      ['bodyweight_added', { loadMode: 'bodyweight_added' as const }],
      ['assisted', { loadMode: 'assisted' as const }],
      ['alternating', { side: 'alternating' as const }],
      ['warmup', { setPurpose: 'warmup' as const }],
    ])('does not request an external cohort for %s', (_label, draft) => {
      const mock = jest.fn();
      global.fetch = mock as unknown as typeof fetch;

      render(
        <GuidedExerciseCard
          exercise={exercise()}
          {...cardProps}
          semantics={semanticsWith(draft)}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: PROGRESSION_COPY.showAria }));

      expect(screen.getByTestId('progression-unsupported')).toBeTruthy();
      expect(
        mock.mock.calls.map(([url]) => String(url)).some((url) => url.includes('/progression')),
      ).toBe(false);
    });

    it('keeps Última vez (raw memory) and comparable progression as distinct panels', async () => {
      global.fetch = routedFetch({ ...READY, readStatus: 'no_history', comparison: null }) as unknown as typeof fetch;

      render(
        <GuidedExerciseCard exercise={exercise()} {...cardProps} semantics={semanticsWith()} />,
      );

      fireEvent.click(screen.getByRole('button', { name: SESSION_COPY.showLastTime }));
      expect(screen.getByTestId('last-time-panel')).toBeTruthy();
      expect(screen.queryByTestId('exercise-progression-panel')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: PROGRESSION_COPY.showAria }));
      expect(screen.getByTestId('exercise-progression-panel')).toBeTruthy();
      expect(screen.queryByTestId('last-time-panel')).toBeNull();
    });

    it('never labels the current open set as a record', () => {
      render(
        <GuidedExerciseCard
          exercise={exercise()}
          {...cardProps}
          completedSets={[{ setIndex: 1, weightKg: '100', reps: 8 }]}
          semantics={semanticsWith()}
        />,
      );

      expect(screen.queryByTestId('pr-badge')).toBeNull();
      expect(screen.queryByText('🏆 PR')).toBeNull();
    });
  });
});
