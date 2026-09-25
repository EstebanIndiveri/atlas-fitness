import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { ProfileHeaderCard } from './ProfileHeaderCard';

describe('ProfileHeaderCard', () => {
  const honestStats = [
    { label: 'EN ATLAS', value: 'Desde septiembre de 2024' },
    {
      label: 'DÍAS ACTIVOS ESTA SEMANA',
      value: '0 de 7 días',
      description: 'Entreno finalizado o check-in',
    },
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
    expect(screen.getByText('EN ATLAS')).toBeTruthy();
    expect(screen.getByText('Desde septiembre de 2024')).toBeTruthy();
    expect(screen.getByText('DÍAS ACTIVOS ESTA SEMANA')).toBeTruthy();
    expect(screen.getByText('0 de 7 días')).toBeTruthy();
    expect(screen.getByText('Entreno finalizado o check-in')).toBeTruthy();
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
