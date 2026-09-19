# Epic UX-Hábito (FE) — mobile-first delight

Must increment on the Atlas Fitness PWA. FE-only; existing `/api/stats/streak`, workouts active, and tips. No new backend endpoints.

**Branch:** `feature/ux-habito-mobile` → `develop`  
**Status:** WIP draft, then Must implementation.

## Product bar (Must)

1. **Mobile-first nativo** (≤390px): dashboard + session shell feel app-like — safe areas, thumb reach, bottom nav (app variant), no cramped header tabs. Tokens stay in `app/globals.css` `@theme` + `lib/ui/tokens.ts`.
2. **Streak delight:** upgrade `StreakChip` (dashboard placement). Celebrate current/longest, motivating zero-state, light CSS motion (respect `prefers-reduced-motion`). Keep `data-testid`s `streak-chip`, `current-streak`, `longest-streak`. Copy `es-AR`.
3. **a11y:** keyboard, focus visible, labels/aria on new/changed controls, WCAG AA token contrast; loading / error / empty for streak and key habit CTAs.

## Out of scope

- New REST endpoints, freeze/revive streaks, Telegram Mini App, native Expo shell.
- Heavy animation libraries.

## Verify

```bash
npm run lint
npm run typecheck
npm test
# Playwright Must (streaks, pwa, session, auth) + ux-habito mobile smoke
npm run test:e2e
```
