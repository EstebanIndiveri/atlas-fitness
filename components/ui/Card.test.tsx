import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card surface roles', () => {
  it('keeps the legacy tone + shadow contract when no level is given', () => {
    render(<Card data-testid="legacy" />);
    const card = screen.getByTestId('legacy');
    expect(card.className).toContain('rounded-lg');
    expect(card.className).toContain('bg-surface');
    expect(card.className).toContain('shadow-card');
  });

  it('renders a flat LEVEL 1 panel with a subtle border', () => {
    render(<Card level="panel" data-testid="panel" />);
    const card = screen.getByTestId('panel');
    expect(card.className).toContain('rounded-panel');
    expect(card.className).toContain('border-line');
    expect(card.className).toContain('bg-surface');
    expect(card.className).not.toContain('shadow');
  });

  it('renders an elevated LEVEL 2 overlay', () => {
    render(<Card level="overlay" data-testid="overlay" />);
    const card = screen.getByTestId('overlay');
    expect(card.className).toContain('rounded-hero');
    expect(card.className).toContain('bg-overlay');
    expect(card.className).toContain('shadow-overlay');
  });
});
