import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { ProfileHeaderCard } from './ProfileHeaderCard';

describe('ProfileHeaderCard', () => {
  const honestStats = [
    { label: 'ANTIGÜEDAD', value: 'No disponible' },
    { label: 'CONSISTENCIA', value: 'Sin datos' },
  ] as const;

  it('renders the user identity with accessible initials', () => {
    render(
      <ProfileHeaderCard
        user={{ id: 1, name: 'Esteban Indiveri', email: 'esteban@example.com', telegramUserId: null }}
        statusLabel="Plan no configurado"
        stats={honestStats}
      />,
    );

    expect(screen.getByLabelText('Iniciales de Esteban Indiveri').textContent).toBe('EI');
    expect(screen.getByText('Esteban Indiveri')).toBeTruthy();
    expect(screen.getByText('esteban@example.com')).toBeTruthy();
    expect(screen.getByText('Plan no configurado')).toBeTruthy();
    expect(screen.getByText('ANTIGÜEDAD')).toBeTruthy();
    expect(screen.getByText('No disponible')).toBeTruthy();
    expect(screen.getByText('CONSISTENCIA')).toBeTruthy();
    expect(screen.getByText('Sin datos')).toBeTruthy();
  });

  it('does not render fabricated Figma sample metrics or verification badges', () => {
    render(
      <ProfileHeaderCard
        user={{ id: 1, name: 'Ana', email: 'ana@example.com', telegramUserId: '4242' }}
        statusLabel="Plan no configurado"
        stats={honestStats}
      />,
    );

    expect(screen.queryByText(/82%|Miembro Sep 2024|verificado|✓/i)).toBeNull();
  });
});
