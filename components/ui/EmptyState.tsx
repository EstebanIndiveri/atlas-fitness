'use client';

import Link from 'next/link';
import { useId } from 'react';

import { buttonClassName } from '@/components/ui/Button';
import { cn } from '@/lib/ui/cn';

import type { ReactNode } from 'react';

export type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
};

export type EmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: readonly EmptyStateAction[];
};

function EmptyStateActionControl({ action }: { action: EmptyStateAction }) {
  const className = buttonClassName({
    variant: action.variant ?? 'primary',
    size: 'lg',
    className: 'sm:w-auto sm:min-w-36',
  });

  if (action.href) {
    return (
      <Link href={action.href} onClick={action.onClick} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

export function EmptyState({ title, description, icon, actions = [] }: EmptyStateProps) {
  const headingId = useId();
  const hasActions = actions.length > 0;

  return (
    <section
      role="region"
      aria-labelledby={headingId}
      className="rounded-xl border border-line bg-surface px-5 py-8 text-center shadow-card sm:px-8"
    >
      {icon ? (
        <div
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-muted text-brand"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <div className="mx-auto max-w-md">
        <h2 id={headingId} className="text-title text-ink">
          {title}
        </h2>
        <p className="mt-3 text-body text-ink-muted">{description}</p>
      </div>
      {hasActions ? (
        <div
          className={cn(
            'mt-6 flex flex-col gap-3',
            actions.length > 1 && 'sm:flex-row sm:justify-center',
          )}
        >
          {actions.map((action, index) => (
            <EmptyStateActionControl
              key={`${action.label}-${action.href ?? 'button'}-${index}`}
              action={action}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
