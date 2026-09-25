import type { TrainingPlanDayOfWeek } from '@/lib/services/training-plan';

/** Weekday order shown in the plan builder: Monday-first, matching the "Esta semana" strip. */
export const PLAN_WEEK_ORDER: readonly TrainingPlanDayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

/** Short Spanish labels keyed by schema weekday (0=Sunday through 6=Saturday). */
export const PLAN_DAY_LABELS: Record<TrainingPlanDayOfWeek, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export const PLAN_COPY = {
  backToToday: '← Volver a hoy',
  title: 'Crear mi plan',
  subtitle: 'Elegí qué días entrenás y qué rutina hacés cada día. Atlas te mostrará el entrenamiento correcto cada mañana.',
  editTitle: 'Editar plan semanal',
  editSubtitle: 'Actualizá los días, las rutinas y el objetivo de tu semana.',
  nameLabel: 'Nombre del plan',
  namePlaceholder: 'Ej: Semana de hipertrofia',
  goalLabel: 'Objetivo (opcional)',
  goalPlaceholder: 'Ej: Hipertrofia',
  daysTitle: 'Días de la semana',
  daysHint: 'Dejá un día en «Descanso» para marcarlo como pausa.',
  restOption: 'Descanso',
  routineSelectLabel: (day: string): string => `Rutina para ${day}`,
  noteLabel: 'Por qué hoy (opcional)',
  notePlaceholder: 'Ej: Foco técnico en empuje',
  submit: 'Guardar plan',
  submitting: 'Guardando…',
  summary: (count: number): string =>
    count === 1 ? '1 día de entrenamiento asignado' : `${count} días de entrenamiento asignados`,
  emptyRoutinesTitle: 'Primero creá una rutina',
  emptyRoutinesBody: 'Necesitás al menos una rutina para armar tu plan semanal. Creála con Coach Atlas o manualmente.',
  emptyRoutinesCoach: 'Crear con Coach Atlas',
  emptyRoutinesManual: 'Crear rutina manualmente',
  genericError: 'No se pudo crear el plan. Probá de nuevo.',
} as const;

export const PLAN_TEST_IDS = {
  form: 'plan-builder-form',
  name: 'plan-name-input',
  goal: 'plan-goal-input',
  daySelect: (day: TrainingPlanDayOfWeek): string => `plan-day-select-${day}`,
  dayNote: (day: TrainingPlanDayOfWeek): string => `plan-day-note-${day}`,
  summary: 'plan-summary',
  submit: 'plan-submit',
  error: 'plan-error',
} as const;
