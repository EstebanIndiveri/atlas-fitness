/**
 * Governed Atlas icon catalog (v0.13 workstream B, brief §13–15).
 *
 * Single source for functional/navigation/state glyphs. The architecture is
 * HYBRID + GOVERNED: navigation, session actions and state signs are drawn on a
 * shared optical grid instead of ad-hoc Unicode or one-off inline SVG.
 *
 * Contract:
 * - 24 × 24 viewBox; optical box ~20px; stroke 1.9 with round caps/joins.
 * - Rendered in `currentColor`; decorative by default (`aria-hidden`).
 * - Functional names live on the surrounding interactive control, never on the
 *   path shape alone.
 *
 * Mood/energy emoji are an explicit exception and are NOT part of this catalog.
 */

/** Shared viewBox for every governed icon. */
export const ATLAS_ICON_VIEW_BOX = '0 0 24 24' as const;

/** Initial stroke width (brief §13: 1.8–2px range). */
export const ATLAS_ICON_STROKE_WIDTH = 1.9 as const;

/** Size tokens in px; consume through the `size` prop, never raw numbers. */
export const ATLAS_ICON_SIZES = { sm: 16, md: 20, lg: 24 } as const;

export type AtlasIconSize = keyof typeof ATLAS_ICON_SIZES;

export const ATLAS_ICON_PATHS = {
  // Navigation (bottom tab semantics).
  today: [
    'M7 3.5v3',
    'M17 3.5v3',
    'M4.75 8.5h14.5',
    'M6 5.5h12a1.75 1.75 0 0 1 1.75 1.75V18A1.75 1.75 0 0 1 18 19.75H6A1.75 1.75 0 0 1 4.25 18V7.25A1.75 1.75 0 0 1 6 5.5z',
    'M8 12.25h3',
    'M8 15.75h6',
  ],
  session: [
    'M7 17 17 7',
    'M12.75 7H17v4.25',
    'M17 17 7 7',
    'M7 7v4.25',
    'M7 7h4.25',
  ],
  progress: [
    'M4.5 19.5V5',
    'M4.5 19.5h15',
    'M8 16v-3.5',
    'M12 16v-7',
    'M16 16v-5',
    'M7.75 10.5 11 8l3 2.5 4.25-5',
  ],
  profile: [
    'M12 12.25a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M5.25 20a6.75 6.75 0 0 1 13.5 0',
  ],

  // Session actions (replace arbitrary ◎ ⇄ ≣ ↺ glyphs).
  technique: [
    'M2.75 12S6 5.75 12 5.75 21.25 12 21.25 12 18 18.25 12 18.25 2.75 12 2.75 12z',
    'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ],
  replace: [
    'M4.5 8.5h11.5',
    'M13 5.5 16 8.5 13 11.5',
    'M19.5 15.5H8',
    'M11 12.5 8 15.5 11 18.5',
  ],
  notes: ['M5.5 7h11.5', 'M5.5 12h11.5', 'M5.5 17h7.5'],
  history: [
    'M12 3.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5z',
    'M12 8V12l3.25 2',
  ],
  progression: ['M3.75 16.5 9 11.25l3.75 3.75L20.25 7.5', 'M15 7.5h5.25V12.75'],
  rest: [
    'M9.5 2.75h5',
    'M12 2.75v2.5',
    'M12 5.25a8.25 8.25 0 1 1 0 16.5 8.25 8.25 0 0 1 0-16.5z',
    'M12 9.25V13l2.75 1.75',
  ],

  // State signs. `complete` is generic completion; `verified` is the reserved
  // progression accent (never the same sign as completion or success).
  complete: [
    'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z',
    'M8.5 12l2.25 2.25L15.75 9',
  ],
  verified: [
    'M12 3 4.75 5.75v5.5c0 4.3 3.1 7.6 7.25 8.5 4.15-.9 7.25-4.2 7.25-8.5v-5.5z',
    'M9.25 12l1.9 1.9 3.6-3.8',
  ],
  tie: ['M6 9.25h12', 'M6 14.75h12'],
  unknown: [
    'M12 3.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5z',
    'M12 11v5',
    'M12 7.75h.01',
  ],
  warning: ['M12 3.75 21 19.25H3z', 'M12 9.5v4.25', 'M12 16.75h.01'],
  error: [
    'M12 3.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5z',
    'M9.25 9.25 14.75 14.75',
    'M14.75 9.25 9.25 14.75',
  ],

  // Utility.
  chevron: ['M9.5 5.5 16 12l-6.5 6.5'],
  search: [
    'M10.75 17.5a6.75 6.75 0 1 0 0-13.5 6.75 6.75 0 0 0 0 13.5z',
    'M15.5 15.5 20 20',
  ],
} as const satisfies Record<string, readonly string[]>;

export type AtlasIconName = keyof typeof ATLAS_ICON_PATHS;

/** Ordered list of governed names, useful for catalogs and tests. */
export const ATLAS_ICON_NAMES = Object.keys(ATLAS_ICON_PATHS) as AtlasIconName[];

/** Full catalog size — the governed set is intentionally focused. */
export const ATLAS_ICON_COUNT = ATLAS_ICON_NAMES.length;
