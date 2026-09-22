import type { ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/ui/cn';

interface SettingsRowProps {
  title: string;
  description?: string;
  href?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  testId?: string;
  tone?: 'default' | 'danger';
}

const ROW_CLASS =
  'flex w-full items-center justify-between gap-4 p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

function RowContent({
  title,
  description,
  icon,
  trailing,
  interactive,
  tone = 'default',
}: Omit<SettingsRowProps, 'href' | 'testId'> & { interactive: boolean }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-muted text-sm text-ink">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0">
          <span className={cn('block text-sm font-medium', tone === 'danger' ? 'text-danger' : 'text-ink')}>
            {title}
          </span>
          {description ? <span className="mt-1 block text-sm text-ink-muted">{description}</span> : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-sm text-ink-muted">
        {trailing}
        {interactive ? <span aria-hidden="true">›</span> : null}
      </span>
    </>
  );
}

/**
 * Renders a settings row as a real link when `href` exists, otherwise as information.
 * @param props Row title, optional icon, optional description, optional href, trailing content, tone, and test id.
 * @returns Link or non-interactive row with consistent layout.
 * @example <SettingsRow icon="◎" title="Plan y rutinas" href="/dashboard/routines" />
 */
export function SettingsRow({ title, description, href, icon, trailing, testId, tone }: SettingsRowProps) {
  const content = (
    <RowContent
      title={title}
      description={description}
      icon={icon}
      trailing={trailing}
      tone={tone}
      interactive={Boolean(href)}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        data-testid={testId}
        aria-label={[title, description].filter(Boolean).join('. ')}
        className={cn(ROW_CLASS, 'hover:bg-surface')}
      >
        {content}
      </Link>
    );
  }

  return (
    <div data-testid={testId} className={ROW_CLASS}>
      {content}
    </div>
  );
}
