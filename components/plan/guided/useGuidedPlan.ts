'use client';

import { useMemo, useRef, useState } from 'react';

import { generateWeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';
import type { WeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';
import type { RoutineDraftLevel } from '@/lib/ai/routine-draft';
import type { RoutineKind } from '@/types/routine';
import type { ExerciseCatalogItem } from '@/types/exercise';

export type GuidedPlanStep = 'brief' | 'review' | 'saving' | 'success';
export type GuidedPlanErrorKind = 'validation' | 'generate' | 'routine_create' | 'plan_create';
export type GuidedPlanField = keyof GuidedPlanFormState;

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

function planDays(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 3;
}

function sessionMinutes(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 55;
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
  const draftRef = useRef<WeeklyPlanDraft | null>(null);
  const stepRef = useRef<GuidedPlanStep>('brief');
  const [draft, setDraft] = useState<WeeklyPlanDraft | null>(null);
  const [step, setStep] = useState<GuidedPlanStep>('brief');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<GuidedPlanError | null>(null);

  const canGenerate = useMemo(() => catalog.length > 0 && !busy && !saving, [busy, catalog.length, saving]);

  function setWizardStep(nextStep: GuidedPlanStep): void {
    stepRef.current = nextStep;
    setStep(nextStep);
  }

  function updateField<K extends GuidedPlanField>(field: K, value: GuidedPlanFormState[K]): void {
    const next = { ...formRef.current, [field]: value };
    formRef.current = next;
    setForm(next);
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
      const nextDraft = await generateWeeklyPlanDraft({
        goal: currentForm.goal,
        daysPerWeek: planDays(currentForm.daysPerWeek),
        experience: currentForm.experience,
        availableEquipment: splitList(currentForm.availableEquipment),
        sessionLengthMinutes: sessionMinutes(currentForm.sessionLengthMinutes),
        focusAreas: splitList(currentForm.focusAreas),
        catalog,
      });
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setWizardStep('review');
    } catch (caught) {
      setError({ kind: 'generate', message: caught instanceof Error ? caught.message : 'No se pudo generar el plan.' });
      setWizardStep('brief');
    } finally {
      setBusy(false);
    }
  }

  async function createRoutine(day: WeeklyPlanDraft['days'][number], kind: RoutineKind): Promise<number> {
    const response = await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routinePayload(day, kind)),
    });
    if (!response.ok) {
      throw {
        kind: 'routine_create',
        message: await readApiMessage(response, 'No se pudo crear una rutina del plan.'),
        status: response.status,
      } satisfies GuidedPlanError;
    }
    const body: unknown = await response.json();
    const id = body && typeof body === 'object' && 'id' in body ? (body as { id?: unknown }).id : null;
    if (typeof id !== 'number') {
      throw { kind: 'routine_create', message: 'La API no devolvió el id de rutina.' } satisfies GuidedPlanError;
    }
    return id;
  }

  async function cleanupCreatedRoutines(routineIds: readonly number[]): Promise<boolean> {
    const results = await Promise.allSettled(
      routineIds.map(async (routineId) => {
        const response = await fetch(`/api/routines/${routineId}`, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error(`No se pudo eliminar la rutina ${routineId}.`);
        }
      }),
    );
    return results.some((result) => result.status === 'rejected');
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
    const routineIds: number[] = [];
    try {
      const kind = inferRoutineKind(formRef.current.availableEquipment);
      for (const day of currentDraft.days) {
        routineIds.push(await createRoutine(day, kind));
      }
      const schedule = currentDraft.days.map((day, index) => ({
        dayOfWeek: day.dayOfWeek,
        routineId: routineIds[index],
        note: `${day.title} · ${day.focus}`,
      }));
      const response = await fetch('/api/training-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentDraft.name, goal: currentDraft.goal, schedule }),
      });
      if (!response.ok) {
        throw {
          kind: 'plan_create',
          message: await readApiMessage(response, 'No se pudo guardar el plan semanal.'),
          status: response.status,
        } satisfies GuidedPlanError;
      }
      setWizardStep('success');
      onSaved?.('/dashboard/today');
    } catch (caught) {
      const cleanupFailed = routineIds.length > 0 ? await cleanupCreatedRoutines(routineIds) : false;
      const nextError = caught && typeof caught === 'object' && 'kind' in caught
        ? caught as GuidedPlanError
        : { kind: 'plan_create', message: 'No se pudo guardar el plan semanal.' } satisfies GuidedPlanError;
      if (cleanupFailed) {
        nextError.message = `${nextError.message} Algunas rutinas creadas no se pudieron limpiar automáticamente.`;
      }
      setError(nextError);
      setWizardStep('review');
    } finally {
      setSaving(false);
    }
  }

  return { form, draft, step, busy, saving, error, canGenerate, updateField, backToBrief, generateDraft, confirmDraft };
}
