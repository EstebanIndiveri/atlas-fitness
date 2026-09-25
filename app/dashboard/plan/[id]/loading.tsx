import { PageContainer } from '@/components/shell/PageContainer';
import { LoadingState } from '@/components/ui/states';

export default function CurrentPlanHubLoading() {
  return (
    <PageContainer>
      <LoadingState label="Cargando tu plan semanal…" />
    </PageContainer>
  );
}
