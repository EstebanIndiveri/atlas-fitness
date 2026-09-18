import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Button, buttonClassName } from './Button';

describe('buttonClassName', () => {
  it('maps variants to token utilities', () => {
    expect(buttonClassName({ variant: 'primary' })).toContain('bg-brand');
    expect(buttonClassName({ variant: 'secondary' })).toContain('ring-line');
    expect(buttonClassName({ variant: 'danger' })).toContain('bg-danger');
    expect(buttonClassName({ variant: 'success' })).toContain('bg-success');
    expect(buttonClassName({ variant: 'warning' })).toContain('bg-warning');
  });

  it('always uses token radius', () => {
    expect(buttonClassName()).toContain('rounded-md');
  });
});

describe('Button', () => {
  it('is a native button with an accessible name', () => {
    render(<Button>Ingresar</Button>);
    const button = screen.getByRole('button', { name: 'Ingresar' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('exposes disabled state to assistive tech', () => {
    render(
      <Button disabled type="submit">
        Cargando...
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Cargando...' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
