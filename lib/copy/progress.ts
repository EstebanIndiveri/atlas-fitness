import type { ProgressPeriod } from '@/lib/services/progress-summary';

/** Product copy for the Progreso screen (es-AR). */
export const PROGRESS_COPY = {
  brand: 'Atlas',
  title: 'Progreso',
  subtitle: '¿Estoy avanzando?',
  updatedToday: 'Actualizado hoy',
  periodAria: 'Rango de progreso',
  periods: {
    week: 'Semana',
    month: 'Mes',
    quarter: '3 meses',
  } satisfies Record<ProgressPeriod, string>,
  interpretation: {
    title: 'Interpretación de Atlas',
    eyebrow: 'Coach Atlas',
    empty: 'Todavía no hay suficientes datos reales para interpretar una tendencia. Registrá sesiones o check-ins y Atlas va a leerlos acá.',
  },
  summary: {
    titles: {
      week: 'Resumen de la semana',
      month: 'Resumen del mes',
      quarter: 'Resumen de 3 meses',
    } satisfies Record<ProgressPeriod, string>,
    sessions: 'Sesiones',
    completedSessionsLabel: 'Sesiones completadas',
    totalTime: 'Tiempo total',
    totalTimeLabel: 'Tiempo total',
    consistency: 'Consistencia',
    consistencyUnavailable: 'Sin datos',
    consistencyUnavailableBody: 'Atlas necesita días activos de la semana para calcularla.',
  },
  week: {
    title: 'Consistencia semanal',
    body: 'Días con entrenamiento terminado o check-in esta semana.',
    activeLabel: 'Días activos esta semana',
    percentLabel: 'Consistencia semanal',
    emptyTitle: 'Sin consistencia semanal',
    emptyBody: 'Cuando haya datos reales de esta semana, Atlas los va a mostrar acá.',
  },
  strength: {
    title: 'Evolución de fuerza',
    volumeLabel: 'Volumen de la última sesión',
    chartLabel: 'Evolución de volumen por sesión',
    startingPointBody: 'Primer punto real: seguí registrando para ver la tendencia.',
    emptyTitle: 'Sin gráfico de fuerza todavía',
    emptyBody: 'Todavía no hay series completadas para graficar tu fuerza.',
    emptyWhy: 'Atlas solo muestra volumen real calculado desde series guardadas: peso × repeticiones.',
  },
  wellbeing: {
    title: 'Bienestar registrado',
    moodLabel: 'Ánimo registrado',
    energyLabel: 'Energía registrada',
    noteLabel: 'Nota',
    emptyTitle: 'Sin check-in de bienestar',
    emptyBody: 'Todavía no registraste ánimo o energía hoy.',
    windowLabel: 'Refleja solo tu check-in de hoy. No se acumula con el período elegido.',
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
  },
  habits: {
    todayOnly: (done: number, total: number) =>
      `Hoy registraste ${done} de ${total} hábitos. Abajo está el detalle día por día del período elegido.`,
  },
  habitActivity: {
    title: 'Actividad de hábitos registrada',
    historyTitle: 'Registro de actividad de hábitos',
    historyWeekdayLegend: 'Cada marca es un día, de lunes a domingo, en hora de Córdoba.',
    periodAria: 'Período de actividad de hábitos',
    loading: 'Cargando tu actividad de hábitos…',
    unavailable: 'No pudimos cargar tu actividad de hábitos. Probá de nuevo en unos minutos.',
    windowLabel: (from: string, to: string) => `Del ${from} al ${to} (hora de Córdoba)`,
    todayIsLabel: (date: string) => `Hoy es ${date} en Córdoba`,
    activeDaysLabel: 'Días con hábitos registrados',
    elapsedDaysLabel: 'Días transcurridos del período',
    recordedDaysLabel: (habitName: string, activeDays: number, elapsedDays: number) =>
      `${habitName}: ${activeDays} de ${elapsedDays} días con registro`,
    summary: (activeDays: number, elapsedDays: number) =>
      `Registraste hábitos en ${activeDays} de los ${elapsedDays} días transcurridos.`,
    insufficientTitle: 'Todavía no hay suficiente período para resumir',
    insufficientElapsed: (elapsedDays: number, minimumElapsedDays: number) =>
      `Pasaron ${elapsedDays} de los ${minimumElapsedDays} días que Atlas necesita para resumir este período.`,
    insufficientNoActivity: 'Todavía no registraste ningún hábito en este período.',
    dayStripAria: (habitName: string) => `Días registrados de ${habitName}`,
    dayRecorded: (localDate: string) => `${localDate}: registrado`,
    dayMissing: (localDate: string) => `${localDate}: sin registro`,
    dayFuture: (localDate: string) => `${localDate}: todavía no llegó`,
    legendRecorded: 'Registrado',
    legendMissing: 'Sin registro',
    legendFuture: 'Todavía no llegó',
  },
  habitTarget: {
    title: 'Días objetivo cumplidos',
    windowLabel: (from: string, to: string) =>
      `Cumplimiento del ${from} al ${to} (hora de Córdoba)`,
    loading: 'Cargando tu cumplimiento de días objetivo…',
    unavailable:
      'No pudimos cargar tu cumplimiento de días objetivo. Probá de nuevo en unos minutos.',
    resultValueLabel: 'Días objetivo cumplidos',
    resultLabel: (completed: number, expected: number) =>
      `${completed} de ${expected} días objetivo`,
    percentValueLabel: 'Porcentaje de días objetivo',
    percentLabel: (percent: number) => `${percent}%`,
    provenance: 'Compara tus registros reales con los días objetivo que definiste.',
    configuredLabel: 'Tenés objetivos activos.',
    partialLabel: 'Tenés objetivo activo solo en algunos hábitos.',
    historicalInactive:
      'El objetivo ya no está activo hoy, pero el resultado de este período se mantiene.',
    notConfiguredTitle: 'Sin días objetivo configurados',
    notConfiguredBody:
      'Configurá los días que querés proponerte; tu actividad anterior sigue visible.',
    noExpectedTitle: 'Todavía no transcurrió un día objetivo',
    noExpectedBody: 'Todavía no transcurrió un día objetivo en este período.',
    extraLabel: (extra: number) =>
      extra === 1
        ? '1 día registrado fuera de objetivo (no cuenta en el resultado)'
        : `${extra} días registrados fuera de objetivo (no cuentan en el resultado)`,
  },
  sessions: {
    title: 'Sesiones recientes',
    emptyTitle: 'Todavía no hay entrenos',
    emptyBody: 'No tienes entrenamientos registrados aún.',
    startFirstWorkout: 'Iniciar tu primer entrenamiento',
    freeWorkout: 'Entrenamiento libre',
    durationLabel: 'Duración de la sesión',
    durationUnavailable: 'Duración no registrada',
    volumeLabel: 'Volumen de la sesión',
    volumeUnavailable: 'Volumen no disponible',
  },
  states: {
    loading: 'Cargando…',
    errorTitle: 'Algo salió mal',
  },
} as const;
