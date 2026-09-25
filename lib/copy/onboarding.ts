/** Product copy for the first-run onboarding wizard (es-AR). */

export type OnboardingStepId = 'goal' | 'pace' | 'equipment' | 'proposal';

/** A selectable option inside a wizard step. */
export interface OnboardingOption {
  /** Stable identifier persisted as the user's answer. */
  readonly id: string;
  /** Primary label shown in the option card. */
  readonly title: string;
  /** Supporting description shown under the label. */
  readonly description: string;
}

/** A selectable step (goal / pace / equipment) of the onboarding wizard. */
export interface OnboardingSelectableStep {
  readonly id: Exclude<OnboardingStepId, 'proposal'>;
  readonly badge: string;
  readonly title: string;
  readonly subtitle: string;
  readonly options: readonly OnboardingOption[];
}

export const ONBOARDING_COPY = {
  header: {
    home: 'Inicio',
    skip: 'Omitir',
    stepLabel: (current: number, total: number) => `Paso ${current} de ${total}`,
  },
  tabs: [
    { id: 'goal', label: 'Objetivo' },
    { id: 'pace', label: 'Ritmo' },
    { id: 'equipment', label: 'Equipo' },
    { id: 'proposal', label: 'Propuesta' },
  ],
  actions: {
    continue: 'Continuar',
    start: 'Empezar',
    back: 'Atrás',
  },
  sync: {
    finishFailure:
      'No pudimos guardar tus preferencias en tu cuenta. Tus respuestas siguen guardadas en este dispositivo. Revisá tu conexión e intentá sincronizar de nuevo.',
    retry: 'Reintentar sincronización',
    importAction: 'Revisar respuestas anteriores',
    importPrompt: 'Si ya habías respondido el onboarding en este navegador, podés revisar esas respuestas antes de importarlas.',
    importTitle: 'Respuestas anteriores de este navegador',
    importConfirm: 'Confirmar importación',
    importCancel: 'Cancelar',
    importMissing: 'No encontramos respuestas anteriores guardadas en este navegador.',
    importFailure:
      'No pudimos comprobar o importar las respuestas. La copia de este navegador se conserva. Revisá tu conexión e intentá de nuevo.',
    importUnauthorized: 'Iniciá sesión para importar estas respuestas a tu cuenta.',
    importAlreadySaved:
      'Ya hay preferencias guardadas en tu cuenta. No se reemplazaron con estas respuestas.',
    importSuccess: 'Las respuestas anteriores ya están guardadas en tu cuenta.',
  },
  steps: [
    {
      id: 'goal',
      badge: 'Punto de partida',
      title: '¿Cuál es tu prioridad principal hoy?',
      subtitle:
        'Atlas calibra el volumen, la intensidad y la progresión según tu punto de enfoque.',
      options: [
        {
          id: 'muscle',
          title: 'Ganar músculo',
          description: 'Hipertrofia estructurada con sobrecarga progresiva adaptada a tu ritmo.',
        },
        {
          id: 'strength',
          title: 'Ganar fuerza',
          description: 'Movimientos compuestos, descansos medidos y rangos de fuerza puros.',
        },
        {
          id: 'fitness',
          title: 'Mejorar condición física',
          description: 'Salud integral, resistencia cardiovascular y energía sostenida todo el día.',
        },
        {
          id: 'consistency',
          title: 'Crear constancia',
          description: 'Hábitos sostenibles sin quemarte, con sesiones flexibles ideales para empezar.',
        },
        {
          id: 'wellbeing',
          title: 'Sentirme mejor en el día a día',
          description: 'Movilidad, descompresión postural y balance sereno de esfuerzo físico.',
        },
      ],
    },
    {
      id: 'pace',
      badge: 'Tu agenda',
      title: '¿Con qué frecuencia vas a entrenar?',
      subtitle: 'Ajustamos el split y la recuperación a los días que tengas disponibles.',
      options: [
        {
          id: 'days-2',
          title: '2 días por semana',
          description: 'Full body compacto, ideal para agendas ajustadas.',
        },
        {
          id: 'days-3',
          title: '3 días por semana',
          description: 'Equilibrio entre estímulo y recuperación para progresar sin quemarte.',
        },
        {
          id: 'days-4',
          title: '4 días por semana',
          description: 'Más volumen por grupo muscular con buena recuperación.',
        },
        {
          id: 'days-5',
          title: '5 o más días',
          description: 'Split avanzado para progresión sostenida y alto volumen.',
        },
      ],
    },
    {
      id: 'equipment',
      badge: 'Tu entorno',
      title: '¿Con qué equipo contás?',
      subtitle: 'Elegimos ejercicios que podés hacer con lo que tenés a mano.',
      options: [
        {
          id: 'gym',
          title: 'Gimnasio completo',
          description: 'Barras, mancuernas, máquinas y poleas disponibles.',
        },
        {
          id: 'dumbbells',
          title: 'Mancuernas en casa',
          description: 'Trabajo con mancuernas y peso ajustable en tu espacio.',
        },
        {
          id: 'bodyweight',
          title: 'Peso corporal',
          description: 'Sin equipo: progresiones de calistenia y movilidad.',
        },
        {
          id: 'bands',
          title: 'Bandas elásticas',
          description: 'Resistencia variable y portátil para entrenar donde estés.',
        },
      ],
    },
  ],
  proposal: {
    badge: 'Tu plan inicial',
    title: 'Tu punto de partida',
    subtitle: 'Con esto Atlas arma tu primer plan y lo ajusta sesión a sesión, sin inventar métricas.',
    goalLabel: 'Objetivo',
    paceLabel: 'Ritmo',
    equipmentLabel: 'Equipo',
    emptyValue: 'Sin elegir',
    goldenPathLabel: 'Cómo vas a entrenar',
    goldenPath:
      'Hoy → check-in → plan de hoy → Coach Atlas adapta → sesión guiada → feedback → progreso.',
  },
} as const;

export const ONBOARDING_TEST_IDS = {
  wizard: 'onboarding-wizard',
  header: 'onboarding-header',
  option: 'onboarding-option',
  continue: 'onboarding-continue',
  skip: 'onboarding-skip',
  back: 'onboarding-back',
} as const;
