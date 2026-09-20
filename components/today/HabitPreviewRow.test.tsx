import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { HabitPreviewRow, type HabitPreview } from './HabitPreviewRow';

const habit: HabitPreview = {
  id: 'hydration',
  name: 'Hidratación',
  hint: 'Objetivo diario',
  icon: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
};

function renderRow() {
  return render(
    <ul>
      <HabitPreviewRow habit={habit} soonLabel="Próximamente" />
    </ul>,
  );
}

describe('HabitPreviewRow', () => {
  it('renders the habit identity and the coming-soon marker', () => {
    renderRow();
    expect(screen.getByText('Hidratación')).toBeTruthy();
    expect(screen.getByText('Objetivo diario')).toBeTruthy();
    expect(screen.getByText('Próximamente')).toBeTruthy();
  });

  it('does not render any fabricated progress value', () => {
    const { container } = renderRow();
    expect(container.textContent).not.toMatch(/\d+\s*(de|\/)\s*\d+/);
    expect(container.textContent).not.toMatch(/%/);
  });
});
