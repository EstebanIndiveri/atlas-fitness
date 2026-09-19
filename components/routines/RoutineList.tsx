import Link from 'next/link';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import type { RoutineSummary } from '@/types/routine';

type RoutineListProps = {
  routines: RoutineSummary[];
  onDelete?: (id: number) => void;
  deletingId?: number | null;
};

function canMutate(routine: RoutineSummary): boolean {
  return routine.isSystem !== true;
}

export function RoutineList({ routines, onDelete, deletingId = null }: RoutineListProps) {
  if (routines.length === 0) {
    return (
      <EmptyState
        title={ROUTINE_COPY.emptyTitle}
        description={ROUTINE_COPY.emptyBody}
        action={
          <Link href="/dashboard/routines/new" className={buttonClassName()} data-testid={ROUTINE_TEST_IDS.createCta}>
            {ROUTINE_COPY.createCta}
          </Link>
        }
      />
    );
  }

  return (
    <ul className="space-y-3" data-testid={ROUTINE_TEST_IDS.list}>
      {routines.map((routine) => {
        const mutate = canMutate(routine);
        return (
          <li key={routine.id}>
            <Card className="p-4" data-testid={ROUTINE_TEST_IDS.listItem}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{routine.name}</h2>
                  {routine.description ? (
                    <p className="mt-1 text-sm text-ink-muted">{routine.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-muted">
                    {routine.kind === 'home' ? ROUTINE_COPY.kindHome : ROUTINE_COPY.kindGym}
                    {' · '}
                    {routine.exercises.map((item) => item.exerciseName).join(' · ')}
                  </p>
                  {routine.isSystem === true ? (
                    <p className="mt-2 text-xs font-medium text-ink-muted">{ROUTINE_COPY.systemBadge}</p>
                  ) : routine.isSystem === false ? (
                    <p className="mt-2 text-xs font-medium text-brand">{ROUTINE_COPY.ownBadge}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/routines/${routine.id}/edit`}
                    className={buttonClassName({ variant: 'secondary', size: 'sm' })}
                  >
                    {mutate ? ROUTINE_COPY.editCta : ROUTINE_COPY.viewCta}
                  </Link>
                  {mutate && onDelete ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={deletingId === routine.id}
                      data-testid={ROUTINE_TEST_IDS.delete}
                      onClick={() => onDelete(routine.id)}
                    >
                      {ROUTINE_COPY.deleteCta}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
