import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { GuidedSessionHeader } from './GuidedSessionHeader';

describe('GuidedSessionHeader', () => {
  it('renders Figma top bar copy, elapsed time, and honest exercise progress dots', () => {
    render(
      <GuidedSessionHeader
        routineName="Full body exprés"
        currentIndex={2}
        totalExercises={4}
        muscleGroup="Piernas"
        elapsedSeconds={1456}
      />,
    );

    expect(screen.getByRole('link', { name: '← Pausar' }).getAttribute('href')).toBe('/dashboard/today');
    expect(screen.getByText('EJERCICIO 2 DE 4 · 24:16')).toBeTruthy();
    expect(screen.getByLabelText('Más opciones de sesión')).toBeTruthy();
    expect(screen.getAllByLabelText(/Progreso de ejercicio/)).toHaveLength(4);
  });

  it('omits progress and chip when the current exercise is not honestly available', () => {
    render(<GuidedSessionHeader routineName="Libre" currentIndex={null} totalExercises={0} />);

    expect(screen.queryByText(/Ejercicio/)).toBeNull();
    expect(screen.queryAllByLabelText(/Progreso de ejercicio/)).toHaveLength(0);
  });
});
