import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Input, fieldClassName } from './Input';

describe('fieldClassName', () => {
  it('uses token border and radius', () => {
    expect(fieldClassName()).toContain('border-line');
    expect(fieldClassName()).toContain('rounded-md');
    expect(fieldClassName(true)).toContain('border-danger');
  });
});

describe('Input', () => {
  it('associates the visible label with the control', () => {
    render(<Input id="email" label="Email" type="email" />);
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('id')).toBe('email');
    expect(input.getAttribute('type')).toBe('email');
  });

  it('exposes hint and error via aria-describedby', () => {
    render(
      <Input
        id="password"
        label="Contraseña"
        type="password"
        hint="Mínimo 8 caracteres"
        error="Las contraseñas no coinciden"
      />,
    );
    const input = screen.getByLabelText('Contraseña');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('password-hint');
    expect(input.getAttribute('aria-describedby')).toContain('password-error');
    expect(screen.getByRole('alert').textContent).toBe('Las contraseñas no coinciden');
  });
});
