'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { isWeeklyPlanDraft } from '@/lib/api/weekly-plan-draft';
import type { WeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';
import type { RoutineDraftLevel } from '@/lib/ai/routine-draft';
import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import type { RoutineKind } from '@/types/routine';
import type { ExerciseCatalogItem } from '@/types/exercise';
import type { UserPreferencesResponse } from '@/types/user-preferences';

export type GuidedPlanStep = 'brief' | 'review' | 'saving' | 'success';
export type GuidedPlanErrorKind = 'validation' | 'generate' | 'plan_create';
export type GuidedPlanField = keyof GuidedPlanFormState;
export type GuidedPlanPreferenceStatus = 'loading' | 'ready' | 'error';

export interface GuidedPlanError {
  kind: GuidedPlanErrorKind;
  message: string;
  status?: number;
}

export interface GuidedPlanFormState {
  goal: string;
  daysPerWeek: string;
  experience: RoutineDraftLevel;
  availableEquipment: string;
  sessionLengthMinutes: string;
  focusAreas: string;
}

interface UseGuidedPlanOptions {
  catalog: readonly ExerciseCatalogItem[];
  onSaved?: (href: string) => void;
}

const INITIAL_FORM: GuidedPlanFormState = {
  goal: '',
  daysPerWeek: '3',
  experience: 'intermediate',
  availableEquipment: 'gimnasio completo',
  sessionLengthMinutes: '55',
  focusAreas: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPreferenceOptionId(
  stepId: 'goal' | 'pace' | 'equipment',
  value: unknown,
): boolean {
  const step = ONBOARDING_COPY.steps.find((candidate) => candidate.id === stepId);
  return (
    value === null ||
    (typeof value === 'string' && step?.options.some((option) => option.id === value) === true)
  );
}

function isUserPreferencesResponse(value: unknown): value is UserPreferencesResponse {
  if (!isRecord(value) || typeof value.hasSavedPreferences !== 'boolean' || !isRecord(value.preferences)) {
    return false;
  }

  const { goal, pace, equipment } = value.preferences;
  return (
    'goal' in value.preferences &&
    'pace' in value.preferences &&
    'equipment' in value.preferences &&
    isPreferenceOptionId('goal', goal) &&
    isPreferenceOptionId('pace', pace) &&
    isPreferenceOptionId('equipment', equipment)
  );
}

function onboardingOptionTitle(stepId: 'goal' | 'equipment', optionId: string): string | undefined {
  const step = ONBOARDING_COPY.steps.find((candidate) => candidate.id === stepId);
  return step?.options.find((option) => option.id === optionId)?.title;
}

function daysForPace(pace: NonNullable<UserPreferencesResponse['preferences']['pace']>): string {
  switch (pace) {
    case 'days-2':
      return '2';
    case 'days-3':
      return '3';
    case 'days-4':
      return '4';
    case 'days-5':
      return '5';
  }
}

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

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function inferRoutineKind(availableEquipment: string): RoutineKind {
  return /(gym|gimnasio|máquina|maquina|barra|mancuerna|rack|polea)/iu.test(availableEquipment)
    ? 'gym'
    : 'home';
}

function routinePayload(day: WeeklyPlanDraft['days'][number], kind: RoutineKind) {
  return {
    name: `Coach Atlas · ${day.title} · ${day.focus}`,
    description: `Rutina propuesta para ${day.focus}.`,
    kind,
    restSeconds: 120,
    exercises: day.exercises.map(({ exerciseId, sortOrder, targetSets, targetReps }) => ({
      exerciseId,
      sortOrder,
      targetSets,
      targetReps,
    })),
  };
}

function isGuidedPlanError(value: unknown): value is GuidedPlanError {
  if (typeof value !== 'object' || value === null || !('kind' in value) || !('message' in value)) {
    return false;
  }

  return (
    (value.kind === 'validation' || value.kind === 'generate' || value.kind === 'plan_create') &&
    typeof value.message === 'string' &&
    (!('status' in value) || typeof value.status === 'number')
  );
}

/**
 * Drives the guided weekly plan wizard and persists accepted drafts through existing HTTP APIs.
 *
 * @param options Exercise catalog and optional success callback for navigation.
 * @returns Wizard state, form mutators, draft generation, and save action.
 * @example
 * const guided = useGuidedPlan({ catalog, onSaved: router.push });
 */
export function useGuidedPlan({ catalog, onSaved }: UseGuidedPlanOptions) {
  const [form, setForm] = useState<GuidedPlanFormState>(INITIAL_FORM);
  const formRef = useRef<GuidedPlanFormState>(INITIAL_FORM);
  const editedFieldsRef = useRef(new Set<GuidedPlanField>());
  const draftRef = useRef<WeeklyPlanDraft | null>(null);
  const mutationIdRef = useRef<string | null>(null);
  const stepRef = useRef<GuidedPlanStep>('brief');
  const [draft, setDraft] = useState<WeeklyPlanDraft | null>(null);
  const [step, setStep] = useState<GuidedPlanStep>('brief');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<GuidedPlanError | null>(null);
  const [preferenceStatus, setPreferenceStatus] = useState<GuidedPlanPreferenceStatus>('loading');
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [preferenceRetryCount, setPreferenceRetryCount] = useState(0);

  const canGenerate = useMemo(() => catalog.length > 0 && !busy && !saving, [busy, catalog.length, saving]);

  useEffect(() => {
    let active = true;

    async function loadPreferences(): Promise<void> {
      try {
        const response = await fetch('/api/profile/preferences');
        if (!response.ok) {
          throw new Error(await readApiMessage(response, 'No pudimos cargar tus preferencias. Probá de nuevo.'));
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new Error('La respuesta de preferencias no es válida.');
        }
        if (!isUserPreferencesResponse(body)) {
          throw new Error('La respuesta de preferencias no es válida.');
        }

        if (!active) return;
        const nextForm = { ...formRef.current };
        if (body.hasSavedPreferences) {
          const { goal, pace, equipment } = body.preferences;
          if (!editedFieldsRef.current.has('goal') && goal !== null) {
            nextForm.goal = onboardingOptionTitle('goal', goal) ?? nextForm.goal;
          }
          if (!editedFieldsRef.current.has('daysPerWeek') && pace !== null) {
            nextForm.daysPerWeek = daysForPace(pace);
          }
          if (!editedFieldsRef.current.has('availableEquipment') && equipment !== null) {
            nextForm.availableEquipment = onboardingOptionTitle('equipment', equipment) ?? nextForm.availableEquipment;
          }
        }
        formRef.current = nextForm;
        setForm(nextForm);
        setPreferenceStatus('ready');
      } catch (caught) {
        if (!active) return;
        setPreferenceError(
          caught instanceof Error ? caught.message : 'No pudimos cargar tus preferencias. Probá de nuevo.',
        );
        setPreferenceStatus('error');
      }
    }

    void loadPreferences();
    return () => {
      active = false;
    };
  }, [preferenceRetryCount]);

  function setWizardStep(nextStep: GuidedPlanStep): void {
    stepRef.current = nextStep;
    setStep(nextStep);
  }

  function updateField<K extends GuidedPlanField>(field: K, value: GuidedPlanFormState[K]): void {
    editedFieldsRef.current.add(field);
    const next = { ...formRef.current, [field]: value };
    formRef.current = next;
    setForm(next);
  }

  function retryPreferences(): void {
    setPreferenceStatus('loading');
    setPreferenceError(null);
    setPreferenceRetryCount((attempt) => attempt + 1);
  }

  function backToBrief(): void {
    setWizardStep('brief');
    setError(null);
  }

  async function generateDraft(): Promise<void> {
    const currentForm = formRef.current;
    setBusy(true);
    setError(null);
    try {
      const requestedDays = Number(currentForm.daysPerWeek);
      const response = await fetch('/api/training-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: currentForm.goal,
          daysPerWeek: requestedDays,
          experience: currentForm.experience,
          availableEquipment: splitList(currentForm.availableEquipment),
          sessionLengthMinutes: Number(currentForm.sessionLengthMinutes),
          focusAreas: splitList(currentForm.focusAreas),
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, 'No se pudo generar el plan.'));
      }
      const body: unknown = await response.json();
      if (!isWeeklyPlanDraft(body) || body.days.length !== requestedDays) {
        throw new Error('La propuesta recibida no es válida.');
      }
      const nextDraft = body;
      draftRef.current = nextDraft;
      mutationIdRef.current = null;
      setDraft(nextDraft);
      setWizardStep('review');
    } catch (caught) {
      setError({ kind: 'generate', message: caught instanceof Error ? caught.message : 'No se pudo generar el plan.' });
      setWizardStep('brief');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft(): Promise<void> {
    if (stepRef.current === 'saving' || stepRef.current === 'success') {
      return;
    }
    const currentDraft = draftRef.current ?? draft;
    if (!currentDraft) {
      setError({ kind: 'validation', message: 'Primero generá una propuesta.' });
      return;
    }
    setSaving(true);
    setWizardStep('saving');
    setError(null);
    try {
      const kind = inferRoutineKind(formRef.current.availableEquipment);
      const mutationId = mutationIdRef.current ?? globalThis.crypto.randomUUID();
      mutationIdRef.current = mutationId;
      const days = currentDraft.days.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        note: `${day.title} · ${day.focus}`.slice(0, 140),
        routine: routinePayload(day, kind),
      }));
      const response = await fetch('/api/training-plan/guided', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mutationId,
          name: currentDraft.name,
          goal: currentDraft.goal,
          days,
        }),
      });
      if (!response.ok) {
        throw {
          kind: 'plan_create',
          message: await readApiMessage(response, 'No se pudo guardar el plan semanal.'),
          status: response.status,
        } satisfies GuidedPlanError;
      }
      mutationIdRef.current = null;
      setWizardStep('success');
      onSaved?.('/dashboard/today');
    } catch (caught) {
      const nextError = isGuidedPlanError(caught)
        ? caught
        : { kind: 'plan_create', message: 'No se pudo guardar el plan semanal.' } satisfies GuidedPlanError;
      setError(nextError);
      setWizardStep('review');
    } finally {
      setSaving(false);
    }
  }

  return {
    form,
    draft,
    step,
    busy,
    saving,
    error,
    canGenerate,
    preferenceStatus,
    preferenceError,
    updateField,
    retryPreferences,
    backToBrief,
    generateDraft,
    confirmDraft,
  };
}
