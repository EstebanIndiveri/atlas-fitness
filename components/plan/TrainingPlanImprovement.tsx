'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageContainer } from '@/components/shell/PageContainer';
import { TrainingPlanImprovementReview } from '@/components/plan/TrainingPlanImprovementReview';
import { buttonClassName } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useTrainingPlanHub } from '@/hooks/useTrainingPlanHub';
import {
  confirmTrainingPlanImprovement,
  generateTrainingPlanImprovement,
  TrainingPlanImprovementClientError,
} from '@/lib/api/training-plan-improvement';
import type { TrainingPlanImprovementProposal } from '@/types/training-plan-improvement';

const MIN_INTENT_LENGTH = 2;
const MAX_INTENT_LENGTH = 60;

/**
 * Reviews and explicitly confirms an improvement to the selected active weekly plan.
 *
 * @param planId - Persisted plan id from the plan hub route.
 * @returns The improvement brief, before/proposal comparison, and confirmed save action.
 * @example
 * <TrainingPlanImprovement planId={12} />
 */
export function TrainingPlanImprovement({ planId }: { planId: number }) {
  const router = useRouter();
  const hubState = useTrainingPlanHub(planId);
  const [intent, setIntent] = useState('');
  const [proposal, setProposal] = useState<TrainingPlanImprovementProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [replacementConfirmed, setReplacementConfirmed] = useState(false);
  const [mutationId, setMutationId] = useState<string | null>(null);

  if (hubState.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState label="Cargando tu plan semanal…" />
      </PageContainer>
    );
  }
  if (hubState.status === 'not_found') {
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
  if (hubState.status === 'error') {
    return (
      <PageContainer>
        <ErrorState title="No se pudo cargar el plan" message={hubState.error} compact={false} />
      </PageContainer>
    );
  }
  if (!hubState.data.plan.isActive) {
    return (
      <PageContainer>
        <EmptyState
          title="Este plan ya no está activo"
          description="Abrí tu plan activo para generar una propuesta de mejora."
          actions={[{ label: 'Volver al plan', href: `/dashboard/plan/${planId}` }]}
        />
      </PageContainer>
    );
  }

  async function generateProposal(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const cleanIntent = intent.trim();
    if (cleanIntent.length < MIN_INTENT_LENGTH || cleanIntent.length > MAX_INTENT_LENGTH) {
      setError('Escribí qué querés mejorar (entre 2 y 60 caracteres).');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await generateTrainingPlanImprovement(planId, cleanIntent);
      setProposal(result);
      setReplacementConfirmed(false);
      setMutationId(null);
    } catch (cause) {
      setError(getErrorMessage(cause, 'No se pudo generar la propuesta.'));
    } finally {
      setBusy(false);
    }
  }

  function cancelProposal(): void {
    setProposal(null);
    setReplacementConfirmed(false);
    setMutationId(null);
    setError(null);
  }

  async function confirmReplacement(): Promise<void> {
    if (!proposal || !replacementConfirmed || applying) {
      return;
    }
    const clientMutationId = mutationId ?? globalThis.crypto.randomUUID();
    setMutationId(clientMutationId);
    setApplying(true);
    setError(null);
    try {
      const newPlanId = await confirmTrainingPlanImprovement(planId, {
        mutationId: clientMutationId,
        intent: proposal.intent,
        expectedPlanUpdatedAt: proposal.currentPlan.plan.updatedAt,
        confirmationToken: proposal.confirmationToken,
        proposal: proposal.proposal,
      });
      router.push(`/dashboard/plan/${newPlanId}`);
    } catch (cause) {
      setError(getErrorMessage(cause, 'No se pudo guardar el plan mejorado.'));
    } finally {
      setApplying(false);
    }
  }

  return (
    <PageContainer className="space-y-6">
      <Link
        href={`/dashboard/plan/${planId}`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        ← Volver al plan semanal
      </Link>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
          Plan semanal activo
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.04em] text-ink">
          Mejorar {hubState.data.plan.name}
        </h1>
        <p className="text-sm leading-6 text-ink-muted">
          Contanos qué querés mejorar. Revisá el antes y la propuesta; el plan actual no cambia
          hasta que confirmes el reemplazo.
        </p>
      </header>

      {proposal ? (
        <TrainingPlanImprovementReview
          proposal={proposal}
          replacementConfirmed={replacementConfirmed}
          applying={applying}
          error={error}
          onCancel={cancelProposal}
          onConfirmationChange={setReplacementConfirmed}
          onConfirm={() => void confirmReplacement()}
        />
      ) : (
        <form onSubmit={(event) => void generateProposal(event)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="plan-improvement-intent" className="text-sm font-semibold text-ink">
              Qué querés mejorar
            </label>
            <textarea
              id="plan-improvement-intent"
              name="intent"
              value={intent}
              onChange={(event) => setIntent(event.currentTarget.value)}
              maxLength={MAX_INTENT_LENGTH}
              rows={3}
              required
              aria-describedby="plan-improvement-intent-help"
              className="min-h-28 w-full rounded-xl border border-line bg-surface p-3 text-base text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              placeholder="Por ejemplo: reducir el volumen y mantener dos días de fuerza"
            />
            <p id="plan-improvement-intent-help" className="text-xs leading-5 text-ink-muted">
              Usaremos tu plan semanal activo como punto de partida. Máximo {MAX_INTENT_LENGTH}{' '}
              caracteres.
            </p>
          </div>
          {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={
              busy
              || intent.trim().length < MIN_INTENT_LENGTH
              || intent.trim().length > MAX_INTENT_LENGTH
            }
            className={buttonClassName({ size: 'lg', className: 'min-h-11 w-full sm:w-auto' })}
          >
            {busy ? 'Generando propuesta…' : 'Generar propuesta'}
          </button>
        </form>
      )}
    </PageContainer>
  );
}

function getErrorMessage(cause: unknown, fallback: string): string {
  return cause instanceof TrainingPlanImprovementClientError
    ? cause.message
    : cause instanceof Error
      ? cause.message
      : fallback;
}
