/**
 * Atlas Fitness visual roles (v0.13 / brief §9–12).
 *
 * Roles compose the primitive tokens in `./tokens.ts` into reusable class
 * contracts. They are the shared vocabulary that A only *establishes*: future
 * touched surfaces consume them, but this workstream does not mass-migrate.
 *
 * Tailwind scans this directory (`@source "../lib/ui"` in `app/globals.css`),
 * so the literal classes below are emitted even before a component uses them.
 */

/**
 * Surface depth roles:
 * - `canvas`  — LEVEL 0 base/page background
 * - `panel`   — LEVEL 1 grouped content, flat with a subtle border
 * - `overlay` — LEVEL 2 temporary elevated focus / hero, shadow allowed
 */
export const SURFACE_ROLE_CLASS = {
  canvas: 'bg-canvas',
  panel: 'rounded-panel border border-line bg-surface',
  overlay: 'rounded-hero border border-line bg-overlay shadow-overlay',
} as const;

export type SurfaceRole = keyof typeof SURFACE_ROLE_CLASS;

/**
 * Shape roles. `pill` is only for pills/circles; controls, panels and heroes
 * have their own radius so new code stops inventing `rounded-[28px]`.
 */
export const RADIUS_ROLE_CLASS = {
  control: 'rounded-control',
  panel: 'rounded-panel',
  hero: 'rounded-hero',
  pill: 'rounded-pill',
} as const;

export type RadiusRole = keyof typeof RADIUS_ROLE_CLASS;

/**
 * Typography roles:
 * - `display`  — editorial serif heading (heroes/chapters only)
 * - `heading`  — page/section heading
 * - `body`     — UI/body copy
 * - `caption`  — helper/secondary copy
 * - `numeric`  — compared figures, tabular so digits keep their column
 */
export const TYPE_ROLE_CLASS = {
  display: 'font-display text-display',
  heading: 'text-title font-semibold',
  body: 'text-body',
  caption: 'text-caption text-ink-muted',
  numeric: 'text-numeric numeric',
} as const;

export type TypeRole = keyof typeof TYPE_ROLE_CLASS;

/**
 * Shared focus-visible ring shape. Color is supplied per role by the caller so
 * primary/danger keep their accessible outline hue without duplicating shape.
 */
export const FOCUS_RING_CLASS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
