import type { HabitTargetAdherencePeriod } from '@/types/habit-adherence';
import type { HabitTargetDayState, HabitTargetWeekday } from '@/types/habit-target';

/**
 * Product copy for the habit-target configuration and read-back loop (es-AR).
 *
 * Two honesty rules drive this copy set:
 *
 * - A schedule is explicit user intention, never inferred, so the configuration
 *   surface always states that the change is effective today in Córdoba and that
 *   earlier days are preserved.
 * - Target adherence is distinct from observed activity, so a day without a
 *   record on an expected day is named as `sin registro`, never as a failure, and
 *   an `extra_recorded` day is named as activity outside the objective.
 */
export const HABIT_TARGET_COPY = {
  sectionTitle: 'Mis días objetivo',
  sectionIntro:
    'Elegí en qué días querés proponerte cada hábito. Tu registro diario sigue igual: si un día no es objetivo, igual podés registrarlo.',
  notConfigured: 'Configurá los días que querés proponerte; tu actividad anterior sigue visible.',
  configuredSummary: (days: string) => `Días objetivo: ${days}`,
  noDaysSelected: 'Elegí al menos un día para guardar.',
  save: 'Guardar cambios',
  saving: 'Guardando…',
  deactivate: 'Desactivar objetivo',
  confirmDeactivateTitle: '¿Desactivar este objetivo?',
  confirmDeactivateBody:
    'Tu actividad anterior queda registrada y los días ya transcurridos no se modifican.',
  confirmDeactivate: 'Confirmar desactivación',
  cancel: 'Cancelar',
  effectiveFromToday: 'Los cambios rigen desde hoy en Córdoba.',
  pastPreserved: 'Los días anteriores a hoy no se modifican.',
  objectiveToday: 'Objetivo de hoy',
  notObjectiveToday: 'Sin objetivo hoy',
  loading: 'Cargando tus días objetivo…',
  loadError: 'No pudimos cargar tus días objetivo. Probá de nuevo en unos minutos.',
  sessionExpired: 'Tu sesión expiró. Iniciá sesión de nuevo para ver tus días objetivo.',
  saveError: 'No pudimos guardar tus días objetivo. Probá de nuevo en unos minutos.',
  deactivateError: 'No pudimos desactivar el objetivo. Probá de nuevo en unos minutos.',
  conflict: 'Tus días objetivo cambiaron en otro dispositivo. Mostramos el estado actualizado.',
  retry: 'Volver a cargar objetivos',
  weekdayGroupAria: (habitName: string) => `Días objetivo de ${habitName}`,
  weekdays: {
    0: 'Domingo',
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
  } satisfies Record<HabitTargetWeekday, string>,
  weekdayShort: {
    0: 'do',
    1: 'lu',
    2: 'ma',
    3: 'mi',
    4: 'ju',
    5: 'vi',
    6: 'sá',
  } satisfies Record<HabitTargetWeekday, string>,
  historyTitle: 'Cumplimiento de objetivos',
  historyIntro:
    'Atlas compara tus días objetivo con tus registros. Solo cuenta los días objetivo que ya transcurrieron.',
  periodAria: 'Período de cumplimiento de objetivos',
  periods: {
    week: 'Semana',
    month: 'Mes',
    quarter: '3 meses',
  } satisfies Record<HabitTargetAdherencePeriod, string>,
  historyLoading: 'Cargando tu cumplimiento…',
  historyError: 'No pudimos cargar tu cumplimiento de objetivos. Probá de nuevo en unos minutos.',
  historySessionExpired: 'Tu sesión expiró. Iniciá sesión de nuevo para ver tu cumplimiento.',
  historyRetry: 'Volver a cargar cumplimiento',
  historyEmpty: 'Todavía no transcurrió un día objetivo en este período.',
  historyEmptyHabit: 'Sin días objetivo transcurridos en este período.',
  historicalResultNote:
    'Este período conserva días objetivo ya transcurridos aunque hoy no tengas un objetivo activo.',
  globalCountsLabel: (completed: number, expected: number) =>
    `${completed} de ${expected} días objetivo`,
  habitCountsLabel: (habitName: string, completed: number, expected: number) =>
    `${habitName}: ${completed} de ${expected} días objetivo`,
  percentLabel: (value: number) => `${value}%`,
  extraRecordedLabel: (count: number) =>
    count === 1 ? '1 registro fuera de objetivo' : `${count} registros fuera de objetivo`,
  dayStripAria: (habitName: string) => `Días objetivo de ${habitName} en el período`,
  dayStateLabel: (localDate: string, stateLabel: string) => `${localDate}: ${stateLabel}`,
  dayStates: {
    expected_completed: 'Día objetivo con registro',
    expected_unrecorded: 'Día objetivo sin registro',
    extra_recorded: 'Registro fuera de objetivo',
    not_expected: 'Día sin objetivo',
    future_expected: 'Día objetivo que todavía no llegó',
  } satisfies Record<HabitTargetDayState, string>,
  legendTitle: 'Referencias del período',
} as const;
