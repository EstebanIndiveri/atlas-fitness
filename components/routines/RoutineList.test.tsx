import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { RoutineList } from './RoutineList';
import { ROUTINE_COPY } from '@/lib/copy/routines';
import type { RoutineSummary } from '@/types/routine';

const systemRoutine: RoutineSummary = {
  id: 1,
  slug: 'full-body-expres',
  name: 'Full body exprés',
  description: null,
  kind: 'gym',
  restSeconds: 45,
  isSystem: true,
  exercises: [],
};

const ownRoutine: RoutineSummary = {
  id: 2,
  slug: 'mia',
  name: 'Mía',
  description: 'Casa',
  kind: 'home',
  restSeconds: 30,
  isSystem: false,
  exercises: [],
};

describe('RoutineList', () => {
  it('links system templates to view and own routines to edit', () => {
    render(<RoutineList routines={[systemRoutine, ownRoutine]} onDelete={jest.fn()} />);
    expect(screen.getByRole('link', { name: ROUTINE_COPY.viewCta }).getAttribute('href')).toBe(
      '/dashboard/routines/1/edit',
    );
    expect(screen.getByRole('link', { name: ROUTINE_COPY.editCta }).getAttribute('href')).toBe(
      '/dashboard/routines/2/edit',
    );
    expect(screen.getByRole('button', { name: ROUTINE_COPY.deleteCta })).toBeTruthy();
  });
});
