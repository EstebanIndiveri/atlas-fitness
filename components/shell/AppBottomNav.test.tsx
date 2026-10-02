import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import { UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { APP_NAV_LINKS, bottomNavTestId } from './nav-links';

jest.mock('next/navigation', () => ({
  usePathname: () => null,
}));

import { AppBottomNav } from './AppBottomNav';

const ARBITRARY_GLYPHS = /[◎⇄≣↺⏳▸↗]/;

describe('AppBottomNav governed iconography', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/dashboard/session');
  });

  it('renders each tab with its label, href and a decorative governed SVG', () => {
    render(<AppBottomNav />);

    const nav = screen.getByRole('navigation', { name: 'Pestañas' });
    for (const link of APP_NAV_LINKS) {
      const tab = within(nav).getByTestId(bottomNavTestId(link.tabId));
      expect(tab.textContent).toContain(link.label);
      expect(tab.getAttribute('href')).toBe(link.href);

      const icon = within(tab).getByTestId(`${link.tabId}-tab-icon`);
      expect(icon.tagName).toBe('svg');
      expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(ARBITRARY_GLYPHS.test(tab.textContent ?? '')).toBe(false);
    }
  });

  it('keeps the active tab distinguishable without relying on icon color alone', () => {
    render(<AppBottomNav />);

    const active = screen.getByTestId(bottomNavTestId('session'));
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(active.className).toContain('text-brand');
    expect(active.className).toContain('bg-brand-muted');

    for (const tabId of ['today', 'progress', 'profile']) {
      const inactive = screen.getByTestId(bottomNavTestId(tabId));
      expect(inactive.getAttribute('aria-current')).toBeNull();
      expect(inactive.className).toContain('text-ink-muted');
      expect(inactive.className).not.toContain('text-brand');
      // Decorative icons must never carry an accessible name of their own.
      expect(within(inactive).getByTestId(`${tabId}-tab-icon`).getAttribute('aria-hidden')).toBe(
        'true',
      );
    }
  });

  it('exposes the shell test id and tab navigation landmark', () => {
    render(<AppBottomNav />);
    expect(screen.getByTestId(UI_COPY_TEST_IDS.appBottomNav)).toBeTruthy();
  });
});
