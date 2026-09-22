import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import { UI_COPY } from '@/lib/copy/ui';

/**
 * Renders entry points for creating a new routine.
 *
 * @returns Coach Atlas guided creation and manual editor actions.
 * @throws Does not throw.
 * @example
 * <NewRoutineActions />
 */
export function NewRoutineActions() {
  return (
    <section aria-labelledby="new-routine-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2
          id="new-routine-title"
          className="font-serif text-xl font-semibold tracking-[-0.03em] text-ink"
        >
          {UI_COPY.training.newRoutineTitle}
        </h2>
        <p className="text-xs text-ink-muted">Asistencia inteligente</p>
      </div>
      <div className="grid gap-3">
        <RoutineActionCard
          href="/dashboard/routines/coach"
          icon="✦"
          title={UI_COPY.training.createWithCoach}
          subtitle="Atlas arma tu rutina según tus objetivos, tiempo y equipamiento"
          badge="IA"
          highlighted
        />
        <RoutineActionCard
          href="/dashboard/routines/new"
          icon="+"
          title={UI_COPY.training.createManually}
          subtitle="Configura series, cargas y tiempos desde cero"
        />
      </div>
    </section>
  );
}

function RoutineActionCard({
  href,
  icon,
  title,
  subtitle,
  badge,
  highlighted = false,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  highlighted?: boolean;
}) {
  return (
    <Card
      className={highlighted ? 'border border-brand/10 bg-brand-muted/70 p-0' : 'border border-line p-0'}
      elevated={false}
    >
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg p-4 text-ink transition hover:bg-canvas/60"
      >
        <span
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-lg font-semibold text-brand"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-bold">
            {title}
            {badge ? (
              <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-brand-foreground">
                {badge}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-muted">{subtitle}</span>
        </span>
        <span className="text-lg text-ink-muted" aria-hidden="true">
          ›
        </span>
      </Link>
    </Card>
  );
}
