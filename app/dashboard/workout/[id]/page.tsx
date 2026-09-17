'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { compareDecimal } from '@/lib/format/decimal';
import type { WorkoutSet, Exercise } from '@/lib/db/schema';
import { formatWeightKg } from '@/lib/format/weight';

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

interface PersonalRecord {
  exerciseId: number;
  exerciseName: string;
  maxWeightKg: string;
  recordDate: Date;
  workoutId: number;
}

export default function WorkoutSessionPage() {
  const params = useParams();
  const router = useRouter();
  const workoutId = params.id as string;

  const [workout, setWorkout] = useState<WorkoutWithSets | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSet, setShowAddSet] = useState(false);
  const [showEndWorkout, setShowEndWorkout] = useState(false);
  const [restTimer, setRestTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Form state
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('');
  const [editingSetId, setEditingSetId] = useState<number | null>(null);

  // End workout form
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [workoutRes, exercisesRes, prsRes] = await Promise.all([
        fetch(`/api/workouts/${workoutId}`),
        fetch('/api/exercises'),
        fetch('/api/stats/prs'),
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

      if (prsRes.ok) {
        const prsData = await prsRes.json();
        setPrs(prsData);
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
        const response = await fetch(`/api/workouts/${workoutId}/sets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exerciseId: selectedExerciseId,
            setIndex,
            reps: parseInt(reps),
            weightKg: weight,
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
        router.push('/dashboard');
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
  };

  const startRestTimer = (seconds: number) => {
    setRestTimer(seconds);
    setTimerActive(true);
  };

  const isPR = (exerciseId: number, weightKg: string): boolean => {
    const pr = prs.find((p) => p.exerciseId === exerciseId);
    if (!pr) return true;
    return compareDecimal(weightKg, pr.maxWeightKg) >= 0;
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Cargando...</p>
      </main>
    );
  }

  if (!workout) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Entrenamiento no encontrado</p>
      </main>
    );
  }

  const isEnded = !!workout.endedAt;

  return (
    <main className="flex min-h-screen flex-col p-4 bg-gray-50">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Volver
          </Link>
          {!isEnded && (
            <button
              onClick={() => setShowEndWorkout(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              Finalizar
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h1 className="text-xl font-bold mb-2">
            {isEnded ? 'Entrenamiento Finalizado' : 'Sesión Activa'}
          </h1>
          <p className="text-sm text-gray-600">
            Inicio: {new Date(workout.startedAt).toLocaleString('es-AR')}
          </p>
          {workout.endedAt && (
            <p className="text-sm text-gray-600">
              Fin: {new Date(workout.endedAt).toLocaleString('es-AR')}
            </p>
          )}
        </div>

        {timerActive && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-center">
            <p className="text-sm font-medium text-blue-900">Descanso</p>
            <p className="text-3xl font-bold text-blue-600">{restTimer}s</p>
          </div>
        )}

        {!isEnded && !showAddSet && (
          <button
            onClick={() => setShowAddSet(true)}
            className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium mb-4"
            data-testid="add-set-button"
          >
            + Agregar Serie
          </button>
        )}

        {showAddSet && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h2 className="text-lg font-semibold mb-3">
              {editingSetId ? 'Editar Serie' : 'Nueva Serie'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Ejercicio</label>
                <select
                  value={selectedExerciseId || ''}
                  onChange={(e) => setSelectedExerciseId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                <div>
                  <label className="block text-sm font-medium mb-1">Repeticiones</label>
                  <input
                    type="number"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    min="1"
                    data-testid="reps-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Peso (kg)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="80"
                    data-testid="weight-input"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddOrUpdateSet}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  data-testid="save-set-button"
                >
                  {editingSetId ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-3">
            Series ({workout.sets.length})
          </h2>
          {workout.sets.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay series registradas aún.</p>
          ) : (
            <div className="space-y-2">
              {workout.sets.map((set) => {
                const exercise = exercises.find((ex) => ex.id === set.exerciseId);
                const isNewPR = isPR(set.exerciseId, set.weightKg);

                return (
                  <div
                    key={set.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-md"
                    data-testid="workout-set"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {exercise?.name || 'Ejercicio desconocido'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {set.reps} reps × {formatWeightKg(set.weightKg)}
                        {isNewPR && (
                          <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded font-medium" data-testid="pr-badge">
                            🏆 PR
                          </span>
                        )}
                      </p>
                    </div>
                    {!isEnded && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSet(set)}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteSet(set.id)}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showEndWorkout && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Finalizar Entrenamiento</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    placeholder="¿Cómo te fue?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Estado de ánimo (opcional)</label>
                  <div className="flex gap-2 justify-between">
                    {[1, 2, 3, 4, 5].map((m) => (
                      <button
                        key={m}
                        onClick={() => setMood(m)}
                        className={`text-3xl p-2 rounded transition ${
                          mood === m ? 'bg-blue-100 scale-110' : 'opacity-50 hover:opacity-100'
                        }`}
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
                  <button
                    onClick={handleEndWorkout}
                    className="flex-1 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    data-testid="confirm-end-workout"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setShowEndWorkout(false)}
                    className="flex-1 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
