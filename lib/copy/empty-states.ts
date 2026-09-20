export const EMPTY_STATE_KEYS = ['no_plan', 'no_history', 'no_checkin', 'ai_unavailable'] as const;

export type EmptyStateKey = (typeof EMPTY_STATE_KEYS)[number];

export type EmptyStateActionCopy = {
  label: string;
  variant: 'primary' | 'secondary';
};

export type EmptyStateCopy = {
  title: string;
  description: string;
  actions: readonly EmptyStateActionCopy[];
};

export const EMPTY_STATE_COPY = {
  no_plan: {
    title: 'Todavía no tenés un plan',
    description: 'Elegí una base para que Atlas muestre recomendaciones solo con datos reales.',
    actions: [
      { label: 'Crear mi plan', variant: 'primary' },
      { label: 'Crear rutina manualmente', variant: 'secondary' },
    ],
  },
  no_history: {
    title: 'Tu progreso empieza con tu primera sesión',
    description: 'Registrá el primer entrenamiento antes de mostrar métricas de avance.',
    actions: [{ label: 'Empezar entrenamiento', variant: 'primary' }],
  },
  no_checkin: {
    title: '¿Cómo estás hoy?',
    description: 'Responder toma menos de 10 segundos.',
    actions: [{ label: 'Responder ahora', variant: 'primary' }],
  },
  ai_unavailable: {
    title: 'Coach Atlas no está disponible temporalmente. Tu entrenamiento original sigue listo.',
    description: 'Podés continuar con la rutina planificada sin inventar adaptaciones.',
    actions: [{ label: 'Empezar entrenamiento', variant: 'primary' }],
  },
} as const satisfies Record<EmptyStateKey, EmptyStateCopy>;
