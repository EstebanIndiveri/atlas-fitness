import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { AtlasIcon } from './AtlasIcon';
import { ATLAS_ICON_NAMES, ATLAS_ICON_PATHS } from './atlas-icons';
import type { AtlasIconName } from './atlas-icons';

describe('AtlasIcon', () => {
  it('renders a decorative governed SVG with the shared optical contract', () => {
    render(<AtlasIcon name="complete" data-testid="icon" />);

    const icon = screen.getByTestId('icon');
    expect(icon.tagName).toBe('svg');
    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon.getAttribute('stroke')).toBe('currentColor');
    expect(icon.getAttribute('stroke-width')).toBe('1.9');
    expect(icon.getAttribute('stroke-linecap')).toBe('round');
    expect(icon.getAttribute('stroke-linejoin')).toBe('round');
    expect(icon.getAttribute('fill')).toBe('none');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.getAttribute('focusable')).toBe('false');
  });

  it('is always decorative so the surrounding control owns the accessible name', () => {
    render(<AtlasIcon name="verified" data-testid="icon" />);
    expect(screen.getByTestId('icon').getAttribute('aria-hidden')).toBe('true');
  });

  it('maps the size token to the governed optical classes', () => {
    const { rerender } = render(<AtlasIcon name="today" size="sm" data-testid="icon" />);
    expect(screen.getByTestId('icon').getAttribute('class')).toContain('size-4');

    rerender(<AtlasIcon name="today" size="md" data-testid="icon" />);
    expect(screen.getByTestId('icon').getAttribute('class')).toContain('size-5');

    rerender(<AtlasIcon name="today" size="lg" data-testid="icon" />);
    expect(screen.getByTestId('icon').getAttribute('class')).toContain('size-6');
  });

  it('defaults to the 20px optical target', () => {
    render(<AtlasIcon name="session" data-testid="icon" />);
    expect(screen.getByTestId('icon').getAttribute('class')).toContain('size-5');
  });

  it('renders the catalog paths for the requested name', () => {
    render(<AtlasIcon name="notes" data-testid="icon" />);
    const rendered = Array.from(screen.getByTestId('icon').querySelectorAll('path')).map((path) =>
      path.getAttribute('d'),
    );
    expect(rendered).toEqual([...ATLAS_ICON_PATHS.notes]);
  });

  it('merges caller classes without dropping the governed size', () => {
    render(<AtlasIcon name="rest" className="text-brand" data-testid="icon" />);
    const className = screen.getByTestId('icon').getAttribute('class') ?? '';
    expect(className).toContain('size-5');
    expect(className).toContain('text-brand');
  });

  it('treats every catalog name as renderable', () => {
    for (const name of ATLAS_ICON_NAMES) {
      const { unmount } = render(<AtlasIcon name={name} data-testid="icon" />);
      expect(screen.getByTestId('icon').querySelectorAll('path').length).toBe(
        ATLAS_ICON_PATHS[name].length,
      );
      unmount();
    }
  });

  it('rejects unknown icon names at compile time', () => {
    // @ts-expect-error the governed catalog has no such member
    const invalidName: AtlasIconName = 'not-a-real-icon';
    expect(ATLAS_ICON_NAMES).not.toContain(invalidName);
  });
});
