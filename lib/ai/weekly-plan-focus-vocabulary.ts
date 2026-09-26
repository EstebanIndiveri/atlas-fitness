/**
 * Shared vocabulary of the weekly plan focus layer.
 *
 * Kept apart from the resolution helpers so the label vocabulary can be read and reviewed on its
 * own. `LOWER_BODY_GROUPS` mirrors the Routine Engine V2 vocabulary
 * (`lib/ai/routine-draft-selection.ts`) so the composer never rejects a lower body selection the
 * engine itself considers valid.
 */

/**
 * Muscle groups the Routine Engine V2 treats as lower body.
 *
 * Kept in sync with the engine vocabulary (`lib/ai/routine-draft-selection.ts`) so the composer
 * never rejects a lower body selection the engine itself considers valid.
 */
export const LOWER_BODY_GROUPS = new Set([
  'piernas',
  'pierna',
  'gluteos',
  'gluteo',
  'isquiotibiales',
  'isquiosurales',
  'cuadriceps',
  'gemelos',
  'gemelo',
  'pantorrillas',
  'pantorrilla',
  'aductores',
  'aductor',
  'abductores',
  'abductor',
  'femoral',
  'femorales',
]);

/** Focus labels a user may type for the lower body as a whole. */
export const LOWER_BODY_ALIASES = new Set(['pierna', 'piernas', 'tren inferior', 'lower body']);

/** Catalog groups that describe recovery work instead of a muscle group to train. */
export const RECOVERY_GROUPS = new Set([
  'core',
  'abdominales',
  'lumbares',
  'movilidad',
  'movilidad y recuperacion',
  'flexibilidad',
  'estiramiento',
  'elongacion',
]);

export const RECOVERY_KEYWORDS = [
  'movilidad',
  'recuperacion',
  'recovery',
  'descanso',
  'estiramiento',
  'regenerativo',
] as const;

export const GYM_EQUIPMENT_KEYWORDS = [
  'gym',
  'gimnasio',
  'mancuerna',
  'barra',
  'rack',
  'polea',
  'maquina',
  'disco',
  'pesa',
  'kettlebell',
  'smith',
] as const;
