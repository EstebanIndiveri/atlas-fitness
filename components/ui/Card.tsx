import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/ui/cn';
import { SURFACE_ROLE_CLASS } from '@/lib/ui/roles';
import type { SurfaceRole } from '@/lib/ui/roles';

const CARD_TONE_CLASS = {
  surface: 'bg-surface',
  brand: 'bg-brand-muted',
  warning: 'bg-warning-muted',
} as const;

export type CardTone = keyof typeof CARD_TONE_CLASS;

/** Level 1 panel and level 2 overlay; canvas is the page, not a card. */
export type CardLevel = Extract<SurfaceRole, 'panel' | 'overlay'>;

const CARD_LEVEL_CLASS: Record<CardLevel, string> = {
  panel: SURFACE_ROLE_CLASS.panel,
  overlay: SURFACE_ROLE_CLASS.overlay,
};

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * Legacy semantic tint. Cannot be combined with `level`, which owns the
   * surface role (background, radius, border and depth).
   */
  tone?: CardTone;
  /** Legacy shadow toggle; ignored when `level` is set. */
  elevated?: boolean;
  /** v0.13 surface role. Prefer this over `tone` + `elevated` on new work. */
  level?: CardLevel;
};

export function Card({
  className,
  tone = 'surface',
  elevated = true,
  level,
  ...props
}: CardProps) {
  const surfaceClass = level
    ? CARD_LEVEL_CLASS[level]
    : cn('rounded-lg', CARD_TONE_CLASS[tone], elevated && 'shadow-card');

  return <div className={cn('p-4 sm:p-6', surfaceClass, className)} {...props} />;
}
