'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { GuidedPlanBriefStep } from '@/components/plan/guided/GuidedPlanBriefStep';
import { GuidedPlanReviewStep } from '@/components/plan/guided/GuidedPlanReviewStep';
import { GuidedPlanStepIndicator } from '@/components/plan/guided/GuidedPlanStepIndicator';
import { useGuidedPlan } from '@/components/plan/guided/useGuidedPlan';
import { PageContainer } from '@/components/shell/PageContainer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import type { ExerciseCatalogItem } from '@/types/exercise';

type CatalogStatus = 'loading' | 'ready' | 'empty' | 'error';

async function readApiMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function GuidedPlanWizard({ catalog }: { catalog: readonly ExerciseCatalogItem[] }) {
  const router = useRouter();
  const guided = useGuidedPlan({ catalog, onSaved: (href) => router.push(href) });

  return (
    <div className="space-y-4">
      <GuidedPlanStepIndicator current={guided.step} />
      {guided.error ? <ErrorState message={guided.error.message} /> : null}
      {guided.step === 'success' ? (
        <Card className="space-y-3 rounded-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Plan guardado</p>
          <h1 className="text-xl font-bold text-ink">Tu semana Atlas ya está lista</h1>
          <p className="text-sm leading-6 text-ink-muted">
            Creamos las rutinas del plan y las asignamos al calendario semanal.
          </p>
          <Button size="lg" onClick={() => router.push('/dashboard/today')}>
            Ir a hoy
          </Button>
        </Card>
      ) : guided.step === 'review' || guided.step === 'saving' ? (
        guided.draft ? (
          <GuidedPlanReviewStep
            draft={guided.draft}
            saving={guided.saving}
            onBack={guided.backToBrief}
            onConfirm={guided.confirmDraft}
          />
        ) : null
      ) : (
        <GuidedPlanBriefStep
          form={guided.form}
          busy={guided.busy}
          canGenerate={guided.canGenerate}
          onFieldChange={guided.updateField}
          onSubmit={guided.generateDraft}
        />
      )}
    </div>
  );
}

export default function GuidedPlanPage() {
  const [status, setStatus] = useState<CatalogStatus>('loading');
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/exercises')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readApiMessage(response, 'No se pudieron cargar ejercicios.'));
        }
        const body: unknown = await response.json();
        if (!Array.isArray(body)) {
          throw new Error('No se pudieron cargar ejercicios.');
        }
        return body as ExerciseCatalogItem[];
      })
      .then((items) => {
        if (!active) return;
        setCatalog(items);
        setStatus(items.length > 0 ? 'ready' : 'empty');
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'No se pudieron cargar ejercicios.');
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageContainer>
      <Link href="/dashboard/plan/new" className="text-sm font-medium text-brand hover:underline">
        Volver al plan manual
      </Link>
      <div className="mt-4">
        {status === 'loading' ? <LoadingState label="Cargando ejercicios…" /> : null}
        {status === 'error' && error ? <ErrorState message={error} compact={false} /> : null}
        {status === 'empty' ? (
          <EmptyState
            title="No hay ejercicios disponibles"
            description="Atlas necesita ejercicios del catálogo para armar una semana honesta."
            action={<Button onClick={() => window.location.reload()}>Reintentar</Button>}
          />
        ) : null}
        {status === 'ready' ? <GuidedPlanWizard catalog={catalog} /> : null}
      </div>
    </PageContainer>
  );
}
