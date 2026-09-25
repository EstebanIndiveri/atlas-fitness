import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PLAN_DAY_LABELS } from '@/lib/copy/plan';
import type { WeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';

interface GuidedPlanReviewStepProps {
  draft: WeeklyPlanDraft;
  saving: boolean;
  onBack: () => void;
  onConfirm: () => Promise<void>;
}

export function GuidedPlanReviewStep({ draft, saving, onBack, onConfirm }: GuidedPlanReviewStepProps) {
  const sourceLabel = draft.source === 'gemini'
    ? 'Propuesta de Gemini · catálogo y objetivos validados y normalizados por Atlas'
    : 'Respaldo determinista de Atlas';

  return (
    <Card className="space-y-4 rounded-2xl">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">{sourceLabel}</p>
        <h2 className="text-xl font-bold text-ink">Revisá la semana propuesta</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Objetivo indicado: <span className="font-semibold text-ink">{draft.goal}</span>. Podés volver al brief
          si querés regenerar antes de guardar.
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Series y repeticiones son objetivos propuestos para revisar antes de guardar.
        </p>
      </div>

      <div className="space-y-3">
        {draft.days.map((day) => (
          <article key={`${day.dayOfWeek}-${day.title}`} className="rounded-2xl border border-line bg-canvas p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">{day.title}</h3>
                <p className="text-sm text-brand">{day.focus}</p>
              </div>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink-muted">
                {PLAN_DAY_LABELS[day.dayOfWeek]}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {day.exercises.map((exercise) => (
                <li key={exercise.exerciseId} className="flex justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{exercise.exerciseName}</span>
                  <span className="text-ink-muted">
                    {exercise.muscleGroup} · {exercise.targetSets}×{exercise.targetReps}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" size="lg" onClick={onBack} disabled={saving}>
          Ajustar brief
        </Button>
        <Button size="lg" onClick={() => void onConfirm()} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar plan'}
        </Button>
      </div>
    </Card>
  );
}
