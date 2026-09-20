/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { AdaptMotivoForm } from './AdaptMotivoForm';

describe('AdaptMotivoForm', () => {
  it('submits presets, free text, and the today check-in path without energy or mood inputs', () => {
    const onSubmit = jest.fn<(text: string) => void>();
    render(<AdaptMotivoForm loading={false} error={null} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tengo 30 min' }));
    expect(onSubmit).toHaveBeenLastCalledWith('Tengo 30 minutos');

    fireEvent.change(screen.getByRole('textbox', { name: 'Contale a Atlas qué cambió' }), {
      target: { value: 'Me molesta el hombro' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar ajuste' }));
    expect(onSubmit).toHaveBeenLastCalledWith('Me molesta el hombro');

    fireEvent.click(screen.getByRole('button', { name: 'Usar mi check-in de hoy' }));
    expect(onSubmit).toHaveBeenLastCalledWith('');
    expect(screen.queryByLabelText(/energ/i)).toBeNull();
    expect(screen.queryByLabelText(/mood/i)).toBeNull();
  });
});
