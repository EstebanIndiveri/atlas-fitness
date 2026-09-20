import { cn } from '@/lib/ui/cn';

interface MoodFaceProps {
  /** Persisted mood scale value (1 = worst, 5 = best). */
  value: number;
  className?: string;
}

const MOUTH_BY_VALUE: Record<number, string> = {
  1: 'M8.5 15.6c1-1.4 5-1.4 7 0',
  2: 'M8.8 15c1-0.9 4.4-0.9 6.4 0',
  3: 'M9 14.6h6',
  4: 'M8.8 13.9c1 1.1 4.4 1.1 6.4 0',
  5: 'M8.3 13.4c1.2 1.8 6.2 1.8 7.4 0',
};

/**
 * Minimalist line-art mood face for the daily check-in, matching the Atlas mockup.
 * Inherits `currentColor`, so selected/hover states are driven by the parent button.
 * @param props Mood scale value (1-5) and optional className.
 * @returns An SVG face whose mouth curvature reflects the mood value.
 * @example <MoodFace value={4} />
 */
export function MoodFace({ value, className }: MoodFaceProps) {
  const mouth = MOUTH_BY_VALUE[value] ?? MOUTH_BY_VALUE[3];

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-6 w-6', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d={mouth} />
    </svg>
  );
}
