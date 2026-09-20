import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { ProfileHeaderCard } from './ProfileHeaderCard';

describe('ProfileHeaderCard', () => {
  it('renders the user identity with accessible initials', () => {
    render(
      <ProfileHeaderCard
        user={{ id: 1, name: 'Esteban Indiveri', email: 'esteban@example.com', telegramUserId: null }}
      />,
    );

    expect(screen.getByLabelText('Iniciales de Esteban Indiveri').textContent).toBe('EI');
    expect(screen.getByText('Esteban Indiveri')).toBeTruthy();
    expect(screen.getByText('esteban@example.com')).toBeTruthy();
  });

  it('does not render fabricated profile metrics or badges', () => {
    render(
      <ProfileHeaderCard
        user={{ id: 1, name: 'Ana', email: 'ana@example.com', telegramUserId: '4242' }}
      />,
    );

    expect(screen.queryByText(/adherencia|consistencia|miembro|verificado/i)).toBeNull();
  });
});
