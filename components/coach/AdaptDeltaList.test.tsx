/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import { AdaptDeltaList } from './AdaptDeltaList';

describe('AdaptDeltaList', () => {
  it('groups kept, reduced and removed exercise deltas with sourced set counts', () => {
    render(
      <AdaptDeltaList
        source="atlas_computed"
        deltas={[
          { exerciseId: 1, name: 'Press banca', action: 'kept', fromSets: 4, toSets: 4 },
          { exerciseId: 2, name: 'Sentadilla', action: 'reduced', fromSets: 5, toSets: 3 },
          { exerciseId: 3, name: 'Curl bíceps', action: 'removed', fromSets: 3, toSets: 0 },
        ]}
      />,
    );

    const reduced = screen.getByRole('list', { name: 'Ejercicios reducidos' });
    expect(within(reduced).getByText('Sentadilla')).toBeTruthy();
    expect(within(reduced).getByText('5 → 3 series')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Ejercicios mantenidos' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Ejercicios quitados' })).toBeTruthy();
  });
});
