/**
 * Atlas motion primitives (v0.13 workstream C, brief §16–17).
 *
 * Pure class-name contracts. This module composes CSS classes declared in
 * `app/globals.css`; it is NOT a JS animation engine and never inspects timing,
 * events or the DOM. Triggers belong to the owning workstream (D/E), not here.
 *
 * Every primitive declares a `prefers-reduced-motion: reduce` equivalent that
 * preserves the information without transform travel.
 */

/** Orientation — locating a destination after a tab/sheet/filter change. */
export const MOTION_ORIENTATION_CLASS = 'motion-orient';

/** Confirmation — one restrained acknowledgement per real saved event. */
export const MOTION_CONFIRMATION_CLASS = 'motion-confirm';

/** Progress — a discrete, layout-stable bar whose value changed. */
export const MOTION_PROGRESS_CLASS = 'motion-progress';

/** Celebration — one bounded, one-shot visual for a verified event (E owns the trigger). */
export const MOTION_CELEBRATION_CLASS = 'motion-celebrate';

/**
 * Durations in ms, mirrored from `app/globals.css`. Tests assert both sides so
 * CSS and TS cannot drift into long theatrical motion.
 */
export const MOTION_DURATION_MS = {
  orientation: 140,
  confirmation: 160,
  progress: 240,
  celebration: 360,
} as const;

export type MotionPurpose = keyof typeof MOTION_DURATION_MS;

/** Approved initial ranges from the brief (ms), inclusive. */
export const MOTION_DURATION_RANGE_MS = {
  orientation: { min: 100, max: 180 },
  confirmation: { min: 100, max: 180 },
  progress: { min: 180, max: 320 },
  celebration: { min: 250, max: 450 },
} as const satisfies Record<MotionPurpose, { min: number; max: number }>;

export const MOTION_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)' as const;
