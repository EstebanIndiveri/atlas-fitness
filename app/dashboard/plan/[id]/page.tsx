import { PageContainer } from '@/components/shell/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { TrainingPlanHub } from '@/components/plan/TrainingPlanHub';

function parsePlanRouteId(id: string): number | null {
  if (!/^[1-9]\d*$/.test(id)) {
    return null;
  }

  const planId = Number(id);
  return Number.isSafeInteger(planId) ? planId : null;
}

/**
 * Renders the authenticated current-plan hub for a persisted plan id.
 *
 * @param props - Next dynamic route params.
 * @returns The current plan hub or a not-found state for invalid ids.
 */
export default async function CurrentPlanHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const planId = parsePlanRouteId(id);

  if (planId === null) {
    return (
      <PageContainer>
        <EmptyState
          title="Plan no encontrado"
          description="No existe o no está disponible para tu cuenta."
          actions={[{ label: 'Volver a Entrenar', href: '/dashboard/session' }]}
        />
      </PageContainer>
    );
  }

  return <TrainingPlanHub planId={planId} />;
}
