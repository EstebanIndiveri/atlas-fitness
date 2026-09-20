import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { GuidedSessionHeader } from './GuidedSessionHeader';

describe('GuidedSessionHeader', () => {
  it('renders honest exercise progress and the current muscle group chip', () => {
    render(
      <GuidedSessionHeader
        routineName="Full body exprés"
        currentIndex={2}
        totalExercises={4}
        muscleGroup="Piernas"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Full body exprés' })).toBeTruthy();
    expect(screen.getByText('Ejercicio 2 de 4')).toBeTruthy();
    expect(screen.getByText('Piernas')).toBeTruthy();
    expect(screen.getAllByLabelText(/Progreso de ejercicio/)).toHaveLength(4);
  });

  it('omits progress and chip when the current exercise is not honestly available', () => {
    render(<GuidedSessionHeader routineName="Libre" currentIndex={null} totalExercises={0} />);

    expect(screen.getByRole('heading', { name: 'Libre' })).toBeTruthy();
    expect(screen.queryByText(/Ejercicio/)).toBeNull();
    expect(screen.queryAllByLabelText(/Progreso de ejercicio/)).toHaveLength(0);
  });
});
