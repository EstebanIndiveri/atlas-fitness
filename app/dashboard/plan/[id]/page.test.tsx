/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/plan/TrainingPlanHub', () => ({
  TrainingPlanHub: ({ planId }: { planId: number }) => (
    <section aria-label="Plan semanal">{planId}</section>
  ),
}));

describe('CurrentPlanHubPage', () => {
  it('renders the plan hub for a valid numeric id', async () => {
    const { default: Page } = await import('./page');

    render(await Page({ params: Promise.resolve({ id: '77' }) }));

    expect(screen.getByRole('region', { name: 'Plan semanal' }).textContent).toBe('77');
  });

  it('renders a not-found state for invalid route ids without partial numeric parsing', async () => {
    const { default: Page } = await import('./page');

    render(await Page({ params: Promise.resolve({ id: '77abc' }) }));

    expect(screen.getByRole('heading', { name: 'Plan no encontrado' })).toBeTruthy();
  });
});
