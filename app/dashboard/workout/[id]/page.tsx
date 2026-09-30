'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, TextArea, fieldClassName } from '@/components/ui/Input';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { SetSemanticsControls } from '@/components/session/SetSemanticsControls';
import { UI_COPY } from '@/lib/copy/ui';
import { describeRecordedAmount, LEGACY_AMOUNT_LABEL } from '@/lib/format/amount';
import { canonicalSemantics } from '@/lib/progression/semantics';
import {
  EMPTY_SEMANTIC_DRAFT,
  applyLoadMode,
  applySide,
  defaultWeightForLoadMode,
  evaluateCapture,
} from '@/lib/session/semantics-draft';
import { cn } from '@/lib/ui/cn';
import type { SemanticDraft, SessionSemanticsControls } from '@/lib/session/semantics-draft';
import type { AmountBasis, LoadMode, RepCountBasis, SetPurpose, Side } from '@/types/progression';
import type { WorkoutSet, Exercise } from '@/lib/db/schema';

interface WorkoutWithSets {
  id: number;
  userId: number;
  startedAt: Date;
  endedAt: Date | null;
  note: string | null;
  mood: number | null;
  deletedAt: Date | null;
  sets: WorkoutSet[];
}

export default function WorkoutSessionPage() {
  const params = useParams();
  const router = useRouter();
  const workoutId = params.id as string;

  const [workout, setWorkout] = useState<WorkoutWithSets | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSet, setShowAddSet] = useState(false);
  const [showEndWorkout, setShowEndWorkout] = useState(false);
  const [restTimer, setRestTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('');
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [semanticDraft, setSemanticDraft] = useState<SemanticDraft>(EMPTY_SEMANTIC_DRAFT);

  const [note, setNote] = useState('');
  const [mood, setMood] = useState<number | null>(null);

  const selectLoadMode = useCallback((mode: LoadMode) => {
    setSemanticDraft((draft) => applyLoadMode(draft, mode));
    setWeight(defaultWeightForLoadMode(mode));
  }, []);
  const selectAmountBasis = useCallback((basis: AmountBasis) => {
    setSemanticDraft((draft) => ({ ...draft, amountBasis: basis }));
  }, []);
  const selectSide = useCallback((side: Side) => {
    setSemanticDraft((draft) => applySide(draft, side));
  }, []);
  const selectSetPurpose = useCallback((purpose: SetPurpose) => {
    setSemanticDraft((draft) => ({ ...draft, setPurpose: purpose }));
  }, []);
  const selectRepCountBasis = useCallback((basis: RepCountBasis) => {
    setSemanticDraft((draft) => ({ ...draft, repCountBasis: basis }));
  }, []);

  const semantics: SessionSemanticsControls = {
    draft: semanticDraft,
    reused: false,
    onLoadMode: selectLoadMode,
    onAmountBasis: selectAmountBasis,
    onSide: selectSide,
    onSetPurpose: selectSetPurpose,
    onRepCountBasis: selectRepCountBasis,
  };

  const fetchData = useCallback(async () => {
    try {
      const [workoutRes, exercisesRes] = await Promise.all([
        fetch(`/api/workouts/${workoutId}`),
        fetch('/api/exercises'),
      ]);

      if (workoutRes.ok) {
        const workoutData = await workoutRes.json();
        setWorkout(workoutData);
        if (workoutData.note) setNote(workoutData.note);
        if (workoutData.mood) setMood(workoutData.mood);
      }

      if (exercisesRes.ok) {
        const exercisesData = await exercisesRes.json();
        setExercises(exercisesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, restTimer]);

  const handleAddOrUpdateSet = async () => {
    if (!selectedExerciseId || !reps || !weight) return;

    try {
      const setIndex = workout?.sets.length ? Math.max(...workout.sets.map((s) => s.setIndex)) + 1 : 1;

      if (editingSetId) {
        const response = await fetch(`/api/workouts/${workoutId}/sets/${editingSetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exerciseId: selectedExerciseId,
            reps: parseInt(reps),
            weightKg: weight,
          }),
        });

        if (response.ok) {
          await fetchData();
          resetForm();
          startRestTimer(90);
        }
      } else {
        const repsValue = parseInt(reps, 10);
        const capture = evaluateCapture(semanticDraft, weight, Number.isFinite(repsValue) ? repsValue : 0);
        if (!capture || !capture.ok) {
          return;
        }
        const response = await fetch(`/api/workouts/${workoutId}/sets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exerciseId: selectedExerciseId,
            setIndex,
            reps: repsValue,
            weightKg: weight,
            semanticCaptureVersion: 1,
            loadMode: capture.canonical.loadMode,
            amountBasis: capture.canonical.amountBasis,
            side: capture.canonical.side,
            setPurpose: capture.canonical.setPurpose,
            repCountBasis: capture.canonical.repCountBasis,
          }),
        });

        if (response.ok) {
          await fetchData();
          resetForm();
          startRestTimer(90);
        }
      }
    } catch (error) {
      console.error('Error adding/updating set:', error);
    }
  };

  const handleEditSet = (set: WorkoutSet) => {
    setEditingSetId(set.id);
    setSelectedExerciseId(set.exerciseId);
    setReps(set.reps.toString());
    setWeight(set.weightKg);
    setShowAddSet(true);
  };

  const handleDeleteSet = async (setId: number) => {
    if (!confirm('¿Eliminar esta serie?')) return;

    try {
      const response = await fetch(`/api/workouts/${workoutId}/sets/${setId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting set:', error);
    }
  };

  const handleEndWorkout = async () => {
    try {
      const response = await fetch(`/api/workouts/${workoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endedAt: new Date().toISOString(),
          note: note || null,
          mood: mood,
        }),
      });

      if (response.ok) {
        router.push('/dashboard/today');
      }
    } catch (error) {
      console.error('Error ending workout:', error);
    }
  };

  const resetForm = () => {
    setShowAddSet(false);
    setEditingSetId(null);
    setSelectedExerciseId(null);
    setReps('10');
    setWeight('');
    setSemanticDraft(EMPTY_SEMANTIC_DRAFT);
  };

  const startRestTimer = (seconds: number) => {
    setRestTimer(seconds);
    setTimerActive(true);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!workout) {
    return (
      <div className="px-4 py-section">
        <p className="text-lg text-ink">{UI_COPY.workoutNotFound}</p>
      </div>
    );
  }

  const isEnded = !!workout.endedAt;
  const repsValueForForm = parseInt(reps, 10);
  const createCapture = evaluateCapture(
    semanticDraft,
    weight,
    Number.isFinite(repsValueForForm) ? repsValueForForm : 0,
  );
  const canCreateCapture = createCapture?.ok === true;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/dashboard/today" className="text-sm font-medium text-brand hover:underline">
          ← Volver
        </Link>
        {!isEnded && (
          <Button variant="success" onClick={() => setShowEndWorkout(true)}>
            Finalizar
          </Button>
        )}
      </div>

      <Card className="mb-4 p-4">
        <h1 className="mb-2 text-xl font-bold text-ink">
          {isEnded ? 'Entrenamiento Finalizado' : 'Sesión Activa'}
        </h1>
        <p className="text-sm text-ink-muted">
          Inicio: {new Date(workout.startedAt).toLocaleString('es-AR')}
        </p>
        {workout.endedAt && (
          <p className="text-sm text-ink-muted">
            Fin: {new Date(workout.endedAt).toLocaleString('es-AR')}
          </p>
        )}
      </Card>

      {timerActive && (
        <Card tone="brand" elevated={false} className="mb-4 border border-brand p-4 text-center">
          <p className="text-sm font-medium text-ink">Descanso</p>
          <p className="text-3xl font-bold text-brand">{restTimer}s</p>
        </Card>
      )}

      {!isEnded && !showAddSet && (
        <Button
          size="lg"
          onClick={() => setShowAddSet(true)}
          className="mb-4"
          data-testid="add-set-button"
        >
          + Agregar Serie
        </Button>
      )}

      {showAddSet && (
        <Card className="mb-4 p-4">
          <h2 className="mb-3 text-lg font-semibold text-ink">
            {editingSetId ? 'Editar Serie' : 'Nueva Serie'}
          </h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="exercise-select" className="mb-1 block text-sm font-medium text-ink">
                Ejercicio
              </label>
              <select
                id="exercise-select"
                value={selectedExerciseId || ''}
                onChange={(e) => setSelectedExerciseId(parseInt(e.target.value))}
                className={fieldClassName()}
                data-testid="exercise-select"
              >
                <option value="">Seleccionar ejercicio</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="reps-input"
                label="Repeticiones"
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                min="1"
                data-testid="reps-input"
              />
              <Input
                id="weight-input"
                label="Peso (kg)"
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="80"
                data-testid="weight-input"
              />
            </div>
            {!editingSetId ? <SetSemanticsControls {...semantics} /> : null}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleAddOrUpdateSet}
                disabled={!editingSetId && !canCreateCapture}
                data-testid="save-set-button"
              >
                {editingSetId ? 'Actualizar' : 'Guardar'}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold text-ink">Series ({workout.sets.length})</h2>
        {workout.sets.length === 0 ? (
          <EmptyState title={UI_COPY.emptySetsTitle} description={UI_COPY.emptySetsBody} />
        ) : (
          <div className="space-y-2">
            {workout.sets.map((set) => {
              const exercise = exercises.find((ex) => ex.id === set.exerciseId);
              const canonical = set.semanticCaptureVersion !== null
                ? canonicalSemantics(set.semanticCaptureVersion, {
                    loadMode: set.loadMode,
                    amountBasis: set.amountBasis,
                    side: set.side,
                    setPurpose: set.setPurpose,
                    repCountBasis: set.repCountBasis,
                  })
                : null;
              const amountLabel =
                canonical?.status === 'canonical'
                  ? describeRecordedAmount(canonical.tuple, set.weightKg)
                  : `${set.weightKg} kg · ${LEGACY_AMOUNT_LABEL}`;

              // An open workout set is never classified as a record: v0.12 only
              // derives a PR from the versioned progression read model over
              // closed workouts, so this page shows raw recorded sets only.

              return (
                <div
                  key={set.id}
                  className="flex items-center justify-between rounded-md border border-line p-3"
                  data-testid="workout-set"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">
                      {exercise?.name || 'Ejercicio desconocido'}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {set.reps} reps · {amountLabel}
                    </p>
                  </div>
                  {!isEnded && (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => handleEditSet(set)}>
                        Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteSet(set.id)}>
                        Eliminar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showEndWorkout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-workout-title"
        >
          <Card className="w-full max-w-md p-6">
            <h2 id="end-workout-title" className="mb-4 text-xl font-bold text-ink">
              Finalizar Entrenamiento
            </h2>
            <div className="space-y-4">
              <TextArea
                id="workout-note"
                label="Notas (opcional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="¿Cómo te fue?"
              />
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Estado de ánimo (opcional)</p>
                <div className="flex justify-between gap-2">
                  {[1, 2, 3, 4, 5].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(m)}
                      aria-pressed={mood === m}
                      aria-label={`Estado de ánimo ${m}`}
                      className={cn(
                        'rounded-md p-2 text-3xl',
                        mood === m ? 'bg-brand-muted' : 'opacity-50 hover:opacity-100',
                      )}
                    >
                      {m === 1 && '😞'}
                      {m === 2 && '😕'}
                      {m === 3 && '😐'}
                      {m === 4 && '😊'}
                      {m === 5 && '😄'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="success"
                  className="flex-1"
                  onClick={handleEndWorkout}
                  data-testid="confirm-end-workout"
                >
                  Confirmar
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => setShowEndWorkout(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
