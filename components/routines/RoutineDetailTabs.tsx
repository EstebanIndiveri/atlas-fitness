import Link from 'next/link';
import { ROUTINE_COPY } from '@/lib/copy/routines';
import { cn } from '@/lib/ui/cn';

type RoutineDetailTabsProps = {
  routineId: number;
};

const tabBaseClass =
  'min-h-11 flex-1 rounded-2xl px-2 py-2 text-center text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-sm';

/**
 * Renders the routine detail segmented navigation, keeping unavailable destinations honest.
 *
 * @param props - The routine identifier used to build edit navigation.
 * @returns The detail/constructor/coach segmented controls.
 */
export function RoutineDetailTabs({ routineId }: RoutineDetailTabsProps) {
  return (
    <nav aria-label="Secciones de rutina" className="rounded-[1.35rem] border border-line bg-canvas p-1 shadow-card">
      <div className="flex items-center gap-1">
        <span className={cn(tabBaseClass, 'bg-ink text-canvas shadow-card')} aria-current="page">
          {ROUTINE_COPY.detailTab}
        </span>
        <Link
          href={`/dashboard/routines/${routineId}/edit`}
          className={cn(tabBaseClass, 'text-ink-muted hover:bg-surface hover:text-ink')}
        >
          {ROUTINE_COPY.constructorTab}
        </Link>
        <button
          type="button"
          className={cn(tabBaseClass, 'cursor-not-allowed text-ink-muted opacity-70')}
          disabled
          title={ROUTINE_COPY.coachUnavailable}
        >
          ✦ {ROUTINE_COPY.coachTab}
        </button>
      </div>
    </nav>
  );
}
