import { UI_COPY } from '@/lib/copy/ui';

export const PUBLIC_NAV_LINKS = [
  { href: '/login', label: UI_COPY.navLogin },
  { href: '/register', label: UI_COPY.navRegister },
] as const;

export const APP_NAV_LINKS = [
  { href: '/dashboard', label: UI_COPY.navHome, tabId: 'home' },
  { href: '/dashboard/today', label: UI_COPY.navToday, tabId: 'today', headerTestId: 'today-link' },
  { href: '/dashboard/session', label: UI_COPY.navSession, tabId: 'session', headerTestId: 'session-link' },
  { href: '/dashboard/history', label: UI_COPY.navHistory, tabId: 'history' },
  { href: '/dashboard/settings', label: UI_COPY.navSettings, tabId: 'settings', headerTestId: 'settings-link' },
] as const;

export type AppNavLink = (typeof APP_NAV_LINKS)[number];

export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function bottomNavTestId(tabId: string): string {
  return `bottom-nav-${tabId}`;
}
