import { PROGRESS_COPY } from '@/lib/copy/progress';
import { formatProgressMonth } from './ProgressFormat';

interface ProgressHeaderProps {
  fromLocalDate: string | null;
  toLocalDate: string | null;
  now?: Date;
  updated: boolean;
}

/**
 * Header for the Progreso screen with current month and freshness badge.
 *
 * @param props Summary date range and optional clock used by tests.
 * @returns The Figma-aligned Progreso header.
 * @example
 * <ProgressHeader fromLocalDate="2026-09-01" toLocalDate="2026-09-30" />
 */
export function ProgressHeader({ toLocalDate, now = new Date(), updated }: ProgressHeaderProps) {
  const monthLabel = formatProgressMonth(toLocalDate, now);

  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-brand" aria-label="Atlas">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-muted text-[11px] text-brand">QA</span>
          <span>{PROGRESS_COPY.brand}</span>
        </div>
        {updated ? (
          <span className="rounded-full bg-brand-muted px-3 py-1 text-[11px] font-semibold text-brand">
            {PROGRESS_COPY.updatedToday}
          </span>
        ) : null}
      </div>
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-ink">
          {PROGRESS_COPY.title}
        </h1>
        <p className="mt-1 flex flex-wrap gap-x-1 text-sm text-ink-muted">
          <span>{PROGRESS_COPY.subtitle}</span>
          <span aria-hidden>·</span>
          <span>{monthLabel}</span>
        </p>
      </div>
    </header>
  );
}
