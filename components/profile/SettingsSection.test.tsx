import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { SettingsSection } from './SettingsSection';

describe('SettingsSection', () => {
  it('wraps content in a titled section', () => {
    render(
      <SettingsSection title="Mi Atlas" testId="mi-atlas-section">
        <p>Contenido</p>
      </SettingsSection>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Mi Atlas' })).toBeTruthy();
    expect(screen.getByTestId('mi-atlas-section').textContent).toContain('Contenido');
  });
});
