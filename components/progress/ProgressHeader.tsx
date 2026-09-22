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
    <header className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-ink" aria-label="Atlas">
          <span className="text-lg leading-none text-brand" aria-hidden>
            ◎
          </span>
          <span>{PROGRESS_COPY.brand}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notificaciones"
            className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink shadow-card ring-1 ring-line"
          >
            <span aria-hidden>⌁</span>
          </button>
          <button
            type="button"
            aria-label="Compartir progreso"
            className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink shadow-card ring-1 ring-line"
          >
            <span aria-hidden>↥</span>
          </button>
        </div>
      </div>
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-[-0.04em] text-ink">
          {PROGRESS_COPY.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <span>¿Estás avanzando?</span>
          <span>{monthLabel}</span>
          {updated ? (
            <span className="rounded-full bg-brand-muted px-3 py-1 text-[11px] font-semibold text-brand">
              {PROGRESS_COPY.updatedToday}
            </span>
          ) : null}
        </p>
      </div>
    </header>
  );
}
