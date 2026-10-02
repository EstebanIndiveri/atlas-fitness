import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { VerifiedPrCelebration } from './VerifiedPrCelebration';
import { PROGRESSION_COPY } from '@/lib/copy/exercise-progression';
import { SESSION_COPY } from '@/lib/copy/session';
import { MOTION_CELEBRATION_CLASS } from '@/lib/ui/motion';
import type { ExerciseProgression, ProgressionSourceSet } from '@/types/progression-read';
import type { VerifiedProgressionEvent } from '@/lib/session/close-pr';

const SEMANTICS = {
  semanticCaptureVersion: 1,
  loadMode: 'external' as const,
  amountBasis: 'total' as const,
  side: 'bilateral' as const,
  setPurpose: 'working' as const,
  repCountBasis: null,
};

function sourceSet(overrides: Partial<ProgressionSourceSet> = {}): ProgressionSourceSet {
  return {
    setId: 11,
    workoutId: 5,
    setIndex: 1,
    reps: 8,
    weightKg: '80',
    endedAt: '2026-09-20T12:00:00.000Z',
    localDate: '2026-09-20',
    semantics: SEMANTICS,
    provenance: 'user_input',
    ...overrides,
  };
}

function event(): VerifiedProgressionEvent {
  const progression: ExerciseProgression = {
    metricId: 'same_reps_external_load',
    progressionRuleVersion: 1,
    readStatus: 'ready',
    cohort: { exerciseId: 3, loadMode: 'external', amountBasis: 'total', side: 'bilateral', reps: 8 },
    currentRepresentative: sourceSet(),
    previousComparableRepresentative: sourceSet({ setId: 4, workoutId: 6, weightKg: '75' }),
    currentBest: sourceSet(),
    comparison: 'new_pr',
    reasons: ['eligible'],
    history: { items: [], nextCursor: null, limit: 10, bounded: true },
    provenance: 'atlas_computed',
  };
  return {
    key: '1:same_reps_external_load:3:8:total:bilateral:11',
    exerciseId: 3,
    progression,
    sourceSet: sourceSet(),
  };
}

describe('VerifiedPrCelebration', () => {
  it('presents the verified fact with the reserved verified token and governed icon', () => {
    render(<VerifiedPrCelebration event={event()} onContinue={jest.fn()} />);

    const panel = screen.getByTestId('verified-pr-celebration');
    expect(panel.getAttribute('data-icon')).toBe('verified');
    expect(panel.className).toContain('bg-verified-muted');
    expect(panel.className).toContain('border-verified');
    expect(panel.className).not.toContain('bg-brand');
    expect(screen.getByTestId('verified-pr-icon').closest('[data-icon]')).toBe(panel);

    expect(screen.getByTestId('verified-pr-title').textContent).toBe(
      PROGRESSION_COPY.comparison.new_pr,
    );
  });

  it('consumes the governed celebration primitive exactly once and no confirmation primitive', () => {
    render(<VerifiedPrCelebration event={event()} onContinue={jest.fn()} />);

    const panel = screen.getByTestId('verified-pr-celebration');
    expect(panel.className).toContain(MOTION_CELEBRATION_CLASS);
    expect(panel.className).not.toContain('motion-confirm');
  });

  it('keeps the exact cohort and source provenance reachable', () => {
    render(<VerifiedPrCelebration event={event()} onContinue={jest.fn()} />);

    const cohort = screen.getByTestId('verified-pr-cohort');
    expect(cohort.textContent).toContain('8 reps');
    expect(cohort.textContent).toContain('carga total');
    expect(cohort.textContent).toContain('bilateral');

    const source = screen.getByTestId('verified-pr-source');
    expect(source.textContent).toContain('8 reps · 80 kg');
    expect(source.querySelector('a')?.getAttribute('href')).toBe('/dashboard/workout/5');
  });

  it('keeps completion (complete/success) visually and textually distinct from the verified PR', () => {
    render(<VerifiedPrCelebration event={event()} onContinue={jest.fn()} />);

    expect(screen.getByText(SESSION_COPY.closePrSavedLine)).toBeTruthy();
    // The completion sentence carries its own `complete` sign; the PR carries `verified`.
    expect(screen.getByTestId('verified-pr-complete-icon')).toBeTruthy();
    expect(screen.getByTestId('verified-pr-icon')).toBeTruthy();
    // Encouragement is restrained and never rewrites the fact.
    expect(screen.getByTestId('verified-pr-encouragement').textContent).toBe(
      SESSION_COPY.closePrEncouragement,
    );
  });

  it('announces the new event politely without stealing focus', () => {
    render(<VerifiedPrCelebration event={event()} onContinue={jest.fn()} />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(document.body);
  });

  it('continues via the explicit CTA', () => {
    const onContinue = jest.fn();
    render(<VerifiedPrCelebration event={event()} onContinue={onContinue} />);

    fireEvent.click(screen.getByTestId('verified-pr-continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('never claims universal strength, 1RM, percentages or a score', () => {
    const { container } = render(<VerifiedPrCelebration event={event()} onContinue={jest.fn()} />);
    expect(container.textContent ?? '').not.toMatch(
      /más fuerte|fuerza subi|1RM|%|nivel|ahora sos|puntaje|ranking/i,
    );
  });
});
