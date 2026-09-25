import { TrainingPlanImprovement } from '@/components/plan/TrainingPlanImprovement';
import { PageContainer } from '@/components/shell/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';

function parsePlanRouteId(id: string): number | null {
  if (!/^[1-9]\d*$/.test(id)) {
    return null;
  }

  const planId = Number(id);
  return Number.isSafeInteger(planId) ? planId : null;
}

/**
 * Renders the explicit proposal-and-confirmation flow for one selected weekly plan.
 *
 * @param props - Next dynamic route params.
 * @returns The improvement screen or a not-found state for invalid plan ids.
 */
export default async function ImprovePlanPage({
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

  return <TrainingPlanImprovement planId={planId} />;
}
