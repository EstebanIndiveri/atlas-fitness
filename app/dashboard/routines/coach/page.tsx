'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageContainer } from '@/components/shell/PageContainer';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, TextArea } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import type { RoutineDraft, RoutineDraftLevel, RoutineDraftLocation } from '@/lib/ai/routine-draft';
import type { ApiError } from '@/types/errors';
import type { ExerciseCatalogItem } from '@/types/exercise';

const COPY = UI_COPY.training.coachRoutine;

type Status = 'loading' | 'ready' | 'empty' | 'error';

type BriefState = {
  goal: string;
  daysPerWeek: string;
  location: RoutineDraftLocation;
  level: RoutineDraftLevel;
};

const initialBrief: BriefState = {
  goal: '',
  daysPerWeek: '3',
  location: 'gym',
  level: 'intermediate',
};

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ApiError>;
    return typeof body.message === 'string' && body.message ? body.message : fallback;
  } catch {
    return fallback;
  }
}

function toCreatePayload(draft: RoutineDraft) {
  return {
    name: draft.name,
    description: draft.description,
    kind: draft.kind,
    restSeconds: draft.restSeconds,
    exercises: draft.exercises.map(({ exerciseId, sortOrder, targetSets, targetReps }) => ({
      exerciseId,
      sortOrder,
      targetSets,
      targetReps,
    })),
  };
}

export default function CoachRoutinePage() {
  const router = useRouter();
  const [brief, setBrief] = useState<BriefState>(initialBrief);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/exercises')
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response, COPY.catalogError));
        return (await response.json()) as ExerciseCatalogItem[];
      })
      .then((items) => {
        if (!active) return;
        setStatus(items.length > 0 ? 'ready' : 'empty');
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : COPY.catalogError);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  async function generateDraft(): Promise<void> {
    setBusy(true);
    setError(null);
    setDraft(null);
    try {
      const response = await fetch('/api/routines/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: brief.goal.trim(),
          daysPerWeek: Number.parseInt(brief.daysPerWeek, 10),
          location: brief.location,
          level: brief.level,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, COPY.generateError));
      setDraft((await response.json()) as RoutineDraft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : COPY.generateError);
    } finally {
      setBusy(false);
    }
  }

  async function acceptDraft(): Promise<void> {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCreatePayload(draft)),
      });
      if (!response.ok) throw new Error(await readApiError(response, COPY.createError));
      router.push('/dashboard/routines');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : COPY.createError);
      setBusy(false);
    }
  }

  if (status === 'loading') return <LoadingState label={COPY.loadingCatalog} />;

  return (
    <PageContainer>
      <Link href="/dashboard/routines" className="text-sm font-medium text-brand hover:underline">
        {COPY.backToRoutines}
      </Link>
      <div className="mt-4 space-y-4">
        <Card className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">{COPY.eyebrow}</p>
            <h1 className="mt-1 text-title font-bold text-ink">{COPY.title}</h1>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{COPY.subtitle}</p>
          </div>
          {status === 'empty' ? (
            <EmptyState title={COPY.emptyTitle} description={COPY.emptyBody} />
          ) : null}
          {status === 'error' && error ? <ErrorState message={error} compact={false} /> : null}
          {status === 'ready' ? (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void generateDraft(); }}>
              <TextArea id="goal" label={COPY.goalLabel} rows={3} value={brief.goal} placeholder={COPY.goalPlaceholder} onChange={(event) => setBrief({ ...brief, goal: event.target.value })} />
              <Input id="daysPerWeek" label={COPY.daysLabel} type="number" min={1} max={7} value={brief.daysPerWeek} onChange={(event) => setBrief({ ...brief, daysPerWeek: event.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-ink">{COPY.locationLabel}<select className="mt-1 w-full rounded-md border border-line bg-surface px-4 py-2" value={brief.location} onChange={(event) => setBrief({ ...brief, location: event.target.value as RoutineDraftLocation })}><option value="gym">{COPY.gym}</option><option value="home">{COPY.home}</option></select></label>
                <label className="text-sm font-medium text-ink">{COPY.levelLabel}<select className="mt-1 w-full rounded-md border border-line bg-surface px-4 py-2" value={brief.level} onChange={(event) => setBrief({ ...brief, level: event.target.value as RoutineDraftLevel })}><option value="beginner">{COPY.beginner}</option><option value="intermediate">{COPY.intermediate}</option><option value="advanced">{COPY.advanced}</option></select></label>
              </div>
              <Button type="submit" size="lg" disabled={busy}>{busy ? COPY.generating : COPY.generate}</Button>
            </form>
          ) : null}
        </Card>
        {error && status === 'ready' ? <ErrorState message={error} /> : null}
        {draft ? <DraftPreview draft={draft} busy={busy} onAccept={() => void acceptDraft()} /> : null}
      </div>
    </PageContainer>
  );
}

function DraftPreview({ draft, busy, onAccept }: { draft: RoutineDraft; busy: boolean; onAccept: () => void }) {
  return (
    <Card className="space-y-4" tone="brand">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{draft.source === 'fallback' ? COPY.fallbackBadge : COPY.geminiBadge}</p>
        <h2 className="mt-1 text-xl font-bold text-ink">{draft.name}</h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{draft.description}</p>
      </div>
      <ul className="space-y-3">
        {draft.exercises.map((exercise) => (
          <li key={exercise.exerciseId} className="rounded-md bg-surface p-3">
            <p className="font-medium text-ink">{exercise.exerciseName}</p>
            <p className="text-sm text-ink-muted">{exercise.muscleGroup} · {exercise.targetSets}×{exercise.targetReps}</p>
          </li>
        ))}
      </ul>
      <button type="button" className={buttonClassName({ size: 'lg' })} disabled={busy} onClick={onAccept}>{busy ? COPY.creating : COPY.accept}</button>
    </Card>
  );
}
