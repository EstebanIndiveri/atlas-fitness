import type { ReactNode } from 'react';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { cn } from '@/lib/ui/cn';

type LoadingStateProps = {
  label?: string;
  compact?: boolean;
};

export function LoadingState({ label = UI_COPY.loading, compact = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex items-center justify-center text-ink-muted',
        compact ? 'py-4 text-sm' : 'min-h-48 text-lg',
      )}
    >
      <p>{label}</p>
    </div>
  );
}

type ErrorStateProps = {
  message: string;
  title?: string;
  compact?: boolean;
};

export function ErrorState({ message, title, compact = true }: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-testid={UI_COPY_TEST_IDS.formError}
      className={cn(
        'rounded-md bg-danger-muted p-3 text-sm text-danger',
        !compact && 'p-6',
      )}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <p>{message}</p>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="py-8 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-2 text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
