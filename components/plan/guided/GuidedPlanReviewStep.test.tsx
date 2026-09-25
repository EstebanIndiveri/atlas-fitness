/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { GuidedPlanReviewStep } from './GuidedPlanReviewStep';
import type { WeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';

function draft(source: WeeklyPlanDraft['source']): WeeklyPlanDraft {
  return {
    source,
    name: 'Semana de fuerza',
    goal: 'ganar fuerza',
    days: [1, 3].map((dayOfWeek, index) => ({
      dayOfWeek: dayOfWeek as 1 | 3,
      title: `Día ${index + 1}`,
      focus: index === 0 ? 'Piernas' : 'Pecho',
      exercises: [{
        exerciseId: index + 1,
        exerciseName: index === 0 ? 'Sentadilla' : 'Press banca',
        muscleGroup: index === 0 ? 'Piernas' : 'Pecho',
        sortOrder: 0,
        targetSets: 3,
        targetReps: 8,
      }],
    })),
  };
}

describe('GuidedPlanReviewStep', () => {
  it('labels Gemini drafts as validated and normalized by Atlas and shows localized weekdays', () => {
    render(
      <GuidedPlanReviewStep
        draft={draft('gemini')}
        saving={false}
        onBack={jest.fn()}
        onConfirm={jest.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('Propuesta de Gemini · catálogo y objetivos validados y normalizados por Atlas')).toBeTruthy();
    expect(screen.getByText('Lunes')).toBeTruthy();
    expect(screen.getByText('Miércoles')).toBeTruthy();
    expect(screen.getByText((_, element) =>
      element?.tagName === 'P' && element.textContent?.includes('Objetivo indicado: ganar fuerza') === true,
    )).toBeTruthy();
    expect(screen.getByText(/series y repeticiones son objetivos propuestos/i)).toBeTruthy();
    expect(screen.queryByText(/semana día [0-6]/i)).toBeNull();
    expect(screen.queryByText(/biometr|recuperación|equipo compatible|duración estimada/i)).toBeNull();
  });

  it('distinguishes deterministic fallback drafts from Gemini proposals', () => {
    render(
      <GuidedPlanReviewStep
        draft={draft('fallback')}
        saving={false}
        onBack={jest.fn()}
        onConfirm={jest.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('Respaldo determinista de Atlas')).toBeTruthy();
    expect(screen.queryByText(/Propuesta de Gemini/)).toBeNull();
  });
});
