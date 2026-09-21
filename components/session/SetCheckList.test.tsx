import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { SetCheckList } from './SetCheckList';

describe('SetCheckList', () => {
  it('renders completed, active, and pending rows in the Figma table structure', () => {
    const onWeightChange = jest.fn();
    render(
      <SetCheckList
        targetSets={3}
        targetReps={8}
        completedCount={0}
        completedSets={[{ setIndex: 1, weightKg: '70.0', reps: 10 }]}
        weight="75"
        onWeightChange={onWeightChange}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    expect(screen.getByText('SERIE')).toBeTruthy();
    expect(screen.getByText('CARGA (KG)')).toBeTruthy();
    expect(screen.getByText('REPS')).toBeTruthy();
    expect(screen.getByText('SERIE 2 EN CURSO')).toBeTruthy();
    expect(screen.getByText('Objetivo: 8 reps')).toBeTruthy();
    expect(screen.getByText('70.0')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('+ Añadir serie')).toBeTruthy();
    expect(screen.getByText('Calentamiento')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Subir peso 2.5 kg' }));
    expect(onWeightChange).toHaveBeenCalledWith('77.5');
  });

  it('displays completed set values by exercise order, not global workout setIndex', () => {
    render(
      <SetCheckList
        targetSets={3}
        targetReps={8}
        completedCount={1}
        completedSets={[{ setIndex: 7, weightKg: '82.5', reps: 6 }]}
        weight="85"
        onWeightChange={jest.fn()}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    expect(screen.getByText('82.5')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('SERIE 2 EN CURSO')).toBeTruthy();
  });


  it('keeps the complete-set control labeled and in the thumb-reach cluster', () => {
    render(
      <SetCheckList
        targetSets={3}
        targetReps={8}
        completedCount={0}
        completedSets={[]}
        weight="40"
        onWeightChange={jest.fn()}
        onCompleteSet={jest.fn()}
        busy={false}
        nextExerciseName="Sentadilla"
      />,
    );

    const complete = screen.getByTestId('complete-set-button');
    expect(complete.textContent).toContain('COMPLETAR SERIE 1');
    expect(complete.className).toContain('min-h-12');
    expect(complete.closest('div')?.className).toContain('bottom-app-cta');
    expect(screen.getByText('Siguiente: Sentadilla')).toBeTruthy();
  });
});
