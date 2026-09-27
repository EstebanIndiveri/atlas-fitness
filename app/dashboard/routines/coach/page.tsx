'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageContainer } from '@/components/shell/PageContainer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, TextArea } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { CoachRoutineStepIndicator } from '@/app/dashboard/routines/coach/CoachRoutineStepIndicator';
import { RoutineDraftProposal } from '@/app/dashboard/routines/coach/RoutineDraftProposal';
import { UI_COPY } from '@/lib/copy/ui';
import type { CoachRoutineStep } from '@/app/dashboard/routines/coach/CoachRoutineStepIndicator';
import type {
  RoutineDraft,
  RoutineDraftCatalogItem,
  RoutineDraftContext,
  RoutineDraftLevel,
  RoutineDraftLocation,
} from '@/lib/ai/routine-draft';
import type { ApiError } from '@/types/errors';
import type { ExerciseCatalogItem } from '@/types/exercise';

const COPY = UI_COPY.training.coachRoutine;

type Status = 'loading' | 'ready' | 'empty' | 'error';
type BriefState = {
  goal: string;
  focusAreas: string;
  availableEquipment: string;
  location: RoutineDraftLocation;
  level: RoutineDraftLevel;
  sessionLengthMinutes: string;
};

type RoutineProposalContext = Omit<RoutineDraftContext, 'catalog'>;

const initialBrief: BriefState = {
  goal: '',
  focusAreas: '',
  availableEquipment: '',
  location: 'gym',
  level: 'intermediate',
  sessionLengthMinutes: '45',
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

function splitBriefList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRoutineDraftCatalogItem(value: unknown): value is RoutineDraftCatalogItem {
  if (!isRecord(value)) return false;
  const item = value;
  return Number.isInteger(item.id)
    && typeof item.slug === 'string'
    && typeof item.name === 'string'
    && typeof item.muscleGroup === 'string'
    && typeof item.instructions === 'string'
    && (typeof item.imageUrl === 'string' || item.imageUrl === null)
    && (typeof item.videoUrl === 'string' || item.videoUrl === null)
    && typeof item.isSystem === 'boolean'
    && (item.equipment === undefined
      || (Array.isArray(item.equipment) && item.equipment.every((equipment) => typeof equipment === 'string')))
    && (item.availableLocations === undefined
      || (Array.isArray(item.availableLocations)
        && item.availableLocations.every((location) => location === 'gym' || location === 'home')));
}

function toProposalContext(brief: BriefState): RoutineProposalContext {
  const availableEquipment = splitBriefList(brief.availableEquipment);
  return {
    goal: brief.goal.trim(),
    focusAreas: splitBriefList(brief.focusAreas),
    location: brief.location,
    ...(availableEquipment.length > 0 ? { availableEquipment } : {}),
    level: brief.level,
    sessionLengthMinutes: Number(brief.sessionLengthMinutes),
  };
}

export default function CoachRoutinePage() {
  const router = useRouter();
  const [brief, setBrief] = useState<BriefState>(initialBrief);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  const [proposalContext, setProposalContext] = useState<RoutineProposalContext | null>(null);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);
  const step: CoachRoutineStep = created ? 'created' : draft ? 'proposal' : 'brief';

  useEffect(() => {
    let active = true;
    void fetch('/api/exercises')
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response, COPY.catalogError));
        return (await response.json()) as ExerciseCatalogItem[];
      })
      .then((items) => {
        if (active) setStatus(items.length > 0 ? 'ready' : 'empty');
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
    const context = toProposalContext(brief);
    setBusy(true);
    setError(null);
    setDraft(null);
    setCreated(false);
    try {
      const response = await fetch('/api/routines/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });
      if (!response.ok) throw new Error(await readApiError(response, COPY.generateError));
      setProposalContext(context);
      setDraft((await response.json()) as RoutineDraft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : COPY.generateError);
    } finally {
      setBusy(false);
    }
  }

  async function loadCandidates(): Promise<RoutineDraftCatalogItem[]> {
    if (!proposalContext) throw new Error(COPY.candidatesError);
    const response = await fetch('/api/routines/coach?mode=candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposalContext),
    });
    if (!response.ok) throw new Error(await readApiError(response, COPY.candidatesError));
    const candidates: unknown = await response.json();
    if (!Array.isArray(candidates) || !candidates.every(isRoutineDraftCatalogItem)) {
      throw new Error(COPY.candidatesError);
    }
    return candidates;
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
      setCreated(true);
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
        <CoachRoutineStepIndicator current={step} />
        <Card className="space-y-4 rounded-xl">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">{COPY.eyebrow}</p>
            <h1 className="mt-1 text-title font-bold text-ink">{COPY.title}</h1>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{COPY.subtitle}</p>
          </div>
          {status === 'empty' ? <EmptyState title={COPY.emptyTitle} description={COPY.emptyBody} /> : null}
          {status === 'error' && error ? <ErrorState message={error} compact={false} /> : null}
          {status === 'ready' && !draft ? <BriefForm brief={brief} busy={busy} setBrief={setBrief} onSubmit={generateDraft} /> : null}
        </Card>
        {error && status === 'ready' ? <ErrorState message={error} /> : null}
        {draft && proposalContext ? (
          <RoutineDraftProposal
            draft={draft}
            sessionLengthMinutes={proposalContext.sessionLengthMinutes}
            busy={busy}
            onDraftChange={setDraft}
            onLoadCandidates={loadCandidates}
            onAccept={() => void acceptDraft()}
            onAdjust={() => {
              setDraft(null);
              setProposalContext(null);
            }}
          />
        ) : null}
      </div>
    </PageContainer>
  );
}

function BriefForm({
  brief,
  busy,
  setBrief,
  onSubmit,
}: {
  brief: BriefState;
  busy: boolean;
  setBrief: (brief: BriefState) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
      <TextArea id="goal" label={COPY.goalLabel} rows={3} maxLength={160} value={brief.goal} placeholder={COPY.goalPlaceholder} onChange={(event) => setBrief({ ...brief, goal: event.target.value })} />
      <TextArea id="focusAreas" label={COPY.focusAreasLabel} rows={2} value={brief.focusAreas} placeholder={COPY.focusAreasPlaceholder} onChange={(event) => setBrief({ ...brief, focusAreas: event.target.value })} />
      <TextArea id="availableEquipment" label={COPY.equipmentLabel} rows={2} value={brief.availableEquipment} placeholder={COPY.equipmentPlaceholder} onChange={(event) => setBrief({ ...brief, availableEquipment: event.target.value })} />
      <Input id="sessionLengthMinutes" label={COPY.sessionLengthLabel} type="number" min={15} max={180} step={1} required value={brief.sessionLengthMinutes} onChange={(event) => setBrief({ ...brief, sessionLengthMinutes: event.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink">{COPY.locationLabel}<select className="mt-1 w-full rounded-md border border-line bg-surface px-4 py-2" value={brief.location} onChange={(event) => setBrief({ ...brief, location: event.target.value as RoutineDraftLocation })}><option value="gym">{COPY.gym}</option><option value="home">{COPY.home}</option></select></label>
        <label className="text-sm font-medium text-ink">{COPY.levelLabel}<select className="mt-1 w-full rounded-md border border-line bg-surface px-4 py-2" value={brief.level} onChange={(event) => setBrief({ ...brief, level: event.target.value as RoutineDraftLevel })}><option value="beginner">{COPY.beginner}</option><option value="intermediate">{COPY.intermediate}</option><option value="advanced">{COPY.advanced}</option></select></label>
      </div>
      <Button type="submit" size="lg" disabled={busy}>{busy ? COPY.generating : COPY.generate}</Button>
    </form>
  );
}
