import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { CompletionMeter } from './TodayWorkoutHeroParts';

describe('CompletionMeter progress motion', () => {
  it('preserves progressbar semantics while using the governed progress purpose', () => {
    render(
      <CompletionMeter
        completed={2}
        total={4}
        label="Progreso"
        unit="ejercicios"
        doneLabel="Completado"
      />,
    );

    const bar = screen.getByRole('progressbar', { name: 'Progreso' });
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');

    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.className).toContain('motion-progress');
    expect(fill.className).not.toContain('duration-500');
    expect(fill.className).not.toContain('transition-[width]');
    expect(fill.getAttribute('style')).toContain('width: 50%');
  });

  it('keeps the completion copy factual and text-backed', () => {
    render(
      <CompletionMeter
        completed={4}
        total={4}
        label="Progreso"
        unit="ejercicios"
        doneLabel="Completado"
      />,
    );

    expect(screen.getByText('4 de 4 ejercicios')).toBeTruthy();
    expect(screen.getByText('Completado')).toBeTruthy();
  });
});
