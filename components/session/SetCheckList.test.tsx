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
        reps="8"
        onRepsChange={jest.fn()}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    expect(screen.getByText('SERIE')).toBeTruthy();
    expect(screen.getByText('CARGA (KG)')).toBeTruthy();
    expect(screen.getByText('REPS')).toBeTruthy();
    expect(screen.getByText('ESTADO')).toBeTruthy();
    expect(screen.getByText('SERIE 2 EN CURSO')).toBeTruthy();
    expect(screen.getByText('Objetivo: 8 reps')).toBeTruthy();
    expect(screen.getByText('70.0')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('+ Añadir serie')).toBeTruthy();
    expect(screen.getByText('Calentamiento')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Subir peso 2.5 kg' }));
    expect(onWeightChange).toHaveBeenCalledWith('77.5');
  });

  it('uses the same compact four-column grid for header and completed rows on mobile', () => {
    render(
      <SetCheckList
        targetSets={3}
        targetReps={8}
        completedCount={1}
        completedSets={[{ setIndex: 1, weightKg: '70.0', reps: 10 }]}
        weight="75"
        onWeightChange={jest.fn()}
        reps="8"
        onRepsChange={jest.fn()}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    const header = screen.getByText('SERIE').closest('[role="row"]') as HTMLElement;
    const completedRow = screen.getByTestId('set-complete');

    expect(header.textContent).toContain('ESTADO');
    expect(header.className).toContain('grid-cols-[2.5rem_minmax(0,1fr)_minmax(2.75rem,0.65fr)_2.75rem]');
    expect(completedRow.className).toContain('grid-cols-[2.5rem_minmax(0,1fr)_minmax(2.75rem,0.65fr)_2.75rem]');
    expect(header.className).not.toContain('minmax(7rem');
    expect(completedRow.className).not.toContain('minmax(6.5rem');
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
        reps="8"
        onRepsChange={jest.fn()}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    expect(screen.getByText('82.5')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('SERIE 2 EN CURSO')).toBeTruthy();
  });


  it('lets the user edit active-set reps with stepper controls and input', () => {
    const onRepsChange = jest.fn();
    render(
      <SetCheckList
        targetSets={3}
        targetReps={8}
        completedCount={0}
        completedSets={[]}
        weight="40"
        onWeightChange={jest.fn()}
        reps="8"
        onRepsChange={onRepsChange}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    const repsInput = screen.getByLabelText('Repeticiones') as HTMLInputElement;
    expect(repsInput.value).toBe('8');

    fireEvent.click(screen.getByRole('button', { name: 'Subir repeticiones 1' }));
    expect(onRepsChange).toHaveBeenCalledWith('9');

    fireEvent.click(screen.getByRole('button', { name: 'Bajar repeticiones 1' }));
    expect(onRepsChange).toHaveBeenCalledWith('7');

    fireEvent.change(repsInput, { target: { value: '12' } });
    expect(onRepsChange).toHaveBeenCalledWith('12');
  });

  it('lays out the active-set steppers in two non-clipping columns', () => {
    render(
      <SetCheckList
        targetSets={3}
        targetReps={8}
        completedCount={0}
        completedSets={[]}
        weight="15"
        onWeightChange={jest.fn()}
        reps="8"
        onRepsChange={jest.fn()}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    const activeRow = screen.getByTestId('set-active');
    const steppers = activeRow.querySelector('.grid.grid-cols-1');
    expect(steppers).not.toBeNull();
    expect(steppers?.className).toContain('min-[430px]:grid-cols-2');

    const weightInput = screen.getByTestId('guided-weight-input');
    expect((weightInput as HTMLInputElement).value).toBe('15');
    const weightControls = weightInput.parentElement as HTMLElement;
    const weightButtons = weightControls.querySelectorAll('button');
    expect(weightButtons).toHaveLength(2);
    weightButtons.forEach((button) => expect(button.className).toContain('shrink-0'));
    expect(weightInput.className).toContain('w-full');
    expect(weightInput.className).toContain('min-w-[5.5rem]');
    expect(weightInput.className).toContain('tabular-nums');
  });

  it('does not allow completing a set with non-positive reps', () => {
    render(
      <SetCheckList
        targetSets={3}
        targetReps={8}
        completedCount={0}
        completedSets={[]}
        weight="40"
        onWeightChange={jest.fn()}
        reps="0"
        onRepsChange={jest.fn()}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    expect(screen.queryByTestId('complete-set-button')).toBeNull();
  });

  it('clamps steppers without emitting NaN for invalid drafts', () => {
    const onWeightChange = jest.fn();
    const onRepsChange = jest.fn();
    render(
      <SetCheckList
        targetSets={3}
        targetReps={8}
        completedCount={0}
        completedSets={[]}
        weight="abc"
        onWeightChange={onWeightChange}
        reps="abc"
        onRepsChange={onRepsChange}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bajar peso 2.5 kg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bajar repeticiones 1' }));
    expect(onWeightChange).toHaveBeenCalledWith('0');
    expect(onRepsChange).toHaveBeenCalledWith('7');
    expect(onWeightChange).not.toHaveBeenCalledWith(expect.stringContaining('NaN'));
    expect(onRepsChange).not.toHaveBeenCalledWith(expect.stringContaining('NaN'));
  });

  it('keeps two and three digit decimal weights fully visible in a tabular input', () => {
    render(
      <SetCheckList
        targetSets={3}
        targetReps={8}
        completedCount={0}
        completedSets={[]}
        weight="125.5"
        onWeightChange={jest.fn()}
        reps="8"
        onRepsChange={jest.fn()}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    const weightInput = screen.getByTestId('guided-weight-input');
    expect((weightInput as HTMLInputElement).value).toBe('125.5');
    expect(weightInput.className).toContain('min-w-[5.5rem]');
    expect(weightInput.className).toContain('tabular-nums');
    expect(weightInput.className).not.toContain('overflow-hidden');
  });

});
