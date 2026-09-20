/** Product copy for first-run onboarding (es-AR). */

export const ONBOARDING_COPY = {
  title: 'Primeros pasos en Atlas',
  eyebrow: 'ONBOARDING',
  intro: 'Te mostramos el camino simple para entrenar con contexto desde Hoy.',
  stepLabel: (current: number, total: number) => `Paso ${current} de ${total}`,
  goldenPathLabel: 'Camino recomendado',
  goldenPath:
    'Hoy → check-in → plan de hoy → Coach Atlas adapta → sesión guiada → feedback post-entreno → progreso.',
  actions: {
    next: 'Siguiente',
    skip: 'Omitir',
    start: 'Empezar',
  },
  steps: [
    {
      title: 'Arrancá siempre por Hoy',
      body: 'Hacés el check-in de ánimo y energía, ves el entrenamiento de hoy y entendés el porqué antes de moverte.',
      badge: 'Hoy',
    },
    {
      title: 'Coach Atlas ajusta el plan',
      body: 'Si venís cansado, con poco tiempo o con mucha energía, Atlas adapta la sesión sin inventar métricas.',
      badge: 'Coach',
    },
    {
      title: 'Tres pestañas, un recorrido',
      body: 'Hoy ordena el día, Entrenar guía rutinas y sesiones, Progreso muestra historial y consistencia real.',
      badge: '3 tabs',
    },
  ],
} as const;

export const ONBOARDING_TEST_IDS = {
  card: 'onboarding-welcome',
  step: 'onboarding-step',
} as const;
