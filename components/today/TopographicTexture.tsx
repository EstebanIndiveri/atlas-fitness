import { cn } from '@/lib/ui/cn';

interface TopographicTextureProps {
  className?: string;
}

/**
 * Decorative topographic contour overlay for the Today workout hero.
 * Purely presentational (aria-hidden, no data) — mirrors the Atlas mockup texture.
 * @param props Optional className to control opacity/positioning.
 * @returns An absolutely-positioned SVG contour pattern.
 * @example <TopographicTexture className="opacity-[0.06]" />
 */
export function TopographicTexture({ className }: TopographicTextureProps) {
  return (
    <svg
      viewBox="0 0 356 384"
      preserveAspectRatio="xMidYMid slice"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M-18 116c120-26 250-14 392 8" />
      <path d="M-36 167c130-30 268-16 436 10" />
      <path d="M-9 220c118-24 250-12 418 12" />
      <path d="M-27 273c126-28 262-14 427 8" />
      <circle cx="303" cy="103" r="25" />
      <circle cx="303" cy="103" r="14" />
    </svg>
  );
}
