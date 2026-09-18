import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/ui/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-brand-foreground hover:bg-brand-hover focus-visible:outline-brand',
  secondary:
    'bg-surface text-ink ring-1 ring-line hover:bg-canvas focus-visible:outline-brand',
  ghost: 'bg-transparent text-ink hover:bg-canvas focus-visible:outline-brand',
  danger: 'bg-danger text-danger-foreground hover:opacity-90 focus-visible:outline-danger',
  success: 'bg-success text-success-foreground hover:opacity-90 focus-visible:outline-success',
  warning: 'bg-warning text-warning-foreground hover:opacity-90 focus-visible:outline-warning',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-xs sm:text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'w-full px-4 py-3 text-sm',
};

export const BUTTON_BASE_CLASS =
  'inline-flex items-center justify-center rounded-md font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function buttonClassName(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  const variant = options.variant ?? 'primary';
  const size = options.size ?? 'md';
  return cn(BUTTON_BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], options.className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClassName({ variant, size, className })} {...props} />;
}
