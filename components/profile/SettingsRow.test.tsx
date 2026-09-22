import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { SettingsRow } from './SettingsRow';

describe('SettingsRow', () => {
  it('renders a navigable row only when href is provided', () => {
    render(
      <SettingsRow
        icon="◎"
        title="Plan y rutinas"
        description="Gestionar rutinas"
        href="/dashboard/routines"
      />,
    );

    const link = screen.getByRole('link', { name: 'Plan y rutinas. Gestionar rutinas' });
    expect(link.getAttribute('href')).toBe('/dashboard/routines');
  });

  it('renders informational rows without fake link or button semantics', () => {
    render(<SettingsRow icon="▣" title="Unidades de medida" description="Kilogramos (kg) · Métrico" />);

    expect(screen.getByText('Unidades de medida')).toBeTruthy();
    expect(screen.getByText('Kilogramos (kg) · Métrico')).toBeTruthy();
    expect(screen.getByText('▣')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders destructive account actions in red without inventing a chevron', () => {
    render(<SettingsRow icon="↪" title="Cerrar sesión" tone="danger" trailing={<button>Cerrar sesión</button>} />);

    expect(screen.getAllByText('Cerrar sesión')).toHaveLength(2);
    expect(screen.queryByText('›')).toBeNull();
  });
});
