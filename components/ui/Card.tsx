import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/ui/cn';

const CARD_TONE_CLASS = {
  surface: 'bg-surface',
  brand: 'bg-brand-muted',
  warning: 'bg-warning-muted',
} as const;

export type CardTone = keyof typeof CARD_TONE_CLASS;

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: CardTone;
  elevated?: boolean;
};

export function Card({ className, tone = 'surface', elevated = true, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-4 sm:p-6',
        elevated && 'shadow-card',
        CARD_TONE_CLASS[tone],
        className,
      )}
      {...props}
    />
  );
}
