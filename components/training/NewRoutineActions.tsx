import Link from 'next/link';

import { buttonClassName } from '@/components/ui/Button';
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
    <section aria-labelledby="new-routine-title">
      <Card className="space-y-4">
        <div>
          <h2 id="new-routine-title" className="text-xl font-bold text-ink">
            {UI_COPY.training.newRoutineTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">{UI_COPY.training.newRoutineBody}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/dashboard/routines/coach"
            className={buttonClassName({ variant: 'secondary', size: 'lg' })}
          >
            {UI_COPY.training.createWithCoach}
          </Link>
          <Link href="/dashboard/routines/new" className={buttonClassName({ size: 'lg' })}>
            {UI_COPY.training.createManually}
          </Link>
        </div>
      </Card>
    </section>
  );
}
