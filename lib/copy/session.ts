/** Product copy for guided sessions (es-AR). */
export const SESSION_COPY = {
  navSession: 'Sesión',
  continueGuided: 'Continuar sesión guiada',
  guidedCta: 'Sesión guiada',
  exerciseProgress: (current: number, total: number) => `Ejercicio ${current} de ${total}`,
  currentExercise: 'Ejercicio actual',
  completedSetProgress: (done: number, total: number) => `${done} de ${total} series`,
  setProgress: (done: number, total: number) => `Serie ${done} de ${total}`,
  targetSets: (sets: number, reps: number) => `${sets} × ${reps} reps`,
  completeSet: 'Completar serie',
  weightLabel: 'Peso (kg)',
  restTitle: 'Descanso',
  skipRest: 'Saltar descanso',
  skipExercise: 'Saltar',
  holdExercise: 'Posponer',
  skipExerciseAria: 'Saltar este ejercicio y pasar al siguiente',
  holdExerciseAria:
    'Posponer este ejercicio para más adelante. Conservamos las series ya hechas.',
  queueTitle: 'Cola de la sesión',
  queueNow: 'Ahora',
  queueHeld: 'Más adelante',
  errorNotActive: 'La sesión no está activa. No se puede saltar ni posponer.',
  errorQueueAction: 'No se pudo actualizar la cola de ejercicios.',
  restDone: '¡Listo! Seguí con la próxima serie.',
  nextExercise: 'Siguiente ejercicio',
  lastExercise: 'Último ejercicio de la rutina',
  lastExerciseDone: 'Terminaste la rutina. Cerrá la sesión cuando quieras.',
  fallbackNext: 'Siguiente según el orden de la rutina.',
  seeVideo: 'Ver video',
  noImage: 'Sin imagen',
  closeEyebrow: 'Entrenamiento completado',
  closeTitle: '¡Sesión completada!',
  closeCongrats: 'Buen trabajo. Cada sesión suma.',
  closeDefaultSubtitle: 'Rutina finalizada',
  closeStatsDuration: 'Duración',
  closeStatsSeries: 'Series',
  closeStatsVolume: 'Volumen',
  closeStatsCompleted: (sets: number) => `${sets} completadas`,
  streakLabel: 'Racha',
  streakDays: (n: number) => (n === 1 ? '1 día seguido' : `${n} días seguidos`),
  moodLabel: '¿Cómo te sentís?',
  effortLabel: 'Esfuerzo percibido',
  effortOptionLabel: (value: number) => `Esfuerzo ${value} de 10`,
  sensationLabel: '¿Cómo terminó el cuerpo?',
  discomfortTitle: 'Molestias',
  discomfortEmpty: 'Sin molestias registradas.',
  discomfortAreaLabel: 'Zona con molestia',
  discomfortIntensityLabel: 'Intensidad',
  discomfortAdd: 'Agregar molestia',
  discomfortRemove: (label: string) => `Quitar molestia ${label}`,
  discomfortMaxReached: 'Podés registrar hasta 5 molestias.',
  noteLabel: 'Nota opcional',
  noteHelp: 'Máximo 500 caracteres.',
  feedbackSaveError: 'No se pudo guardar el feedback post-entrenamiento. Probá de nuevo.',
  saveAndClose: 'Guardar y cerrar',
  improvementNone: 'Sin dato previo para comparar.',
  improvementSame: (name: string) => `${name}: mismo peso tope que la última sesión.`,
  improvementUp: (name: string, delta: string) => `${name}: +${delta} kg vs la última sesión.`,
  improvementDown: (name: string, delta: string) => `${name}: ${delta} kg menos que la última sesión.`,
  activeExists: 'Ya tenés una sesión activa. Continuá o finalizala antes de empezar otra.',
  errorLoad: 'No se pudo cargar la sesión guiada.',
  motivators: [
    'Bien. Respirá y prepará la próxima.',
    'Constancia > intensidad suelta.',
    'Una serie más. Vas bien.',
    'El descanso también entrena.',
    'Firme. No aflojes el control.',
  ],
} as const;

export const MOOD_EMOJIS = [
  { value: 1, emoji: '😞', label: 'Mal' },
  { value: 2, emoji: '😕', label: 'Regular' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '😊', label: 'Bien' },
  { value: 5, emoji: '😄', label: 'Excelente' },
] as const;

export const POST_WORKOUT_SENSATIONS = [
  { value: 'bad', legacyMood: 1, emoji: '😞', label: 'Mal' },
  { value: 'hard', legacyMood: 2, emoji: '😤', label: 'Difícil' },
  { value: 'neutral', legacyMood: 3, emoji: '😐', label: 'Neutral' },
  { value: 'good', legacyMood: 4, emoji: '😊', label: 'Bien' },
  { value: 'great', legacyMood: 5, emoji: '😄', label: 'Excelente' },
] as const;

export const DISCOMFORT_AREA_OPTIONS = [
  { value: 'neck', label: 'Cuello' },
  { value: 'shoulder', label: 'Hombro' },
  { value: 'elbow', label: 'Codo' },
  { value: 'wrist', label: 'Muñeca' },
  { value: 'back', label: 'Espalda' },
  { value: 'hip', label: 'Cadera' },
  { value: 'knee', label: 'Rodilla' },
  { value: 'ankle', label: 'Tobillo' },
  { value: 'other', label: 'Otra' },
] as const;

export const DISCOMFORT_INTENSITY_OPTIONS = [
  { value: 'mild', label: 'Leve' },
  { value: 'moderate', label: 'Moderada' },
  { value: 'strong', label: 'Fuerte' },
] as const;

export function motivatorForSet(setNumber: number): string {
  const pool = SESSION_COPY.motivators;
  const index = Math.abs(setNumber - 1) % pool.length;
  return pool[index];
}

export function formatImprovement(item: {
  exerciseName: string;
  direction: 'up' | 'down' | 'same' | 'none';
  deltaKg: string | null;
}): string {
  if (item.direction === 'up' && item.deltaKg) {
    return SESSION_COPY.improvementUp(item.exerciseName, item.deltaKg);
  }
  if (item.direction === 'down' && item.deltaKg) {
    return SESSION_COPY.improvementDown(item.exerciseName, item.deltaKg);
  }
  if (item.direction === 'same') {
    return SESSION_COPY.improvementSame(item.exerciseName);
  }
  return SESSION_COPY.improvementNone;
}
