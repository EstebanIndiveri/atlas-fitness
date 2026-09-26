import { AppError } from '@/types/errors';

import type {
  RoutineDraft,
  RoutineDraftCatalogItem,
  RoutineDraftContext,
  RoutineDraftExercise,
  RoutineDraftLevel,
} from './routine-draft-types';

const LEVEL_TARGETS: Record<RoutineDraftLevel, { sets: number; reps: number; rest: number }> = {
  beginner: { sets: 2, reps: 12, rest: 75 },
  intermediate: { sets: 3, reps: 10, rest: 120 },
  advanced: { sets: 4, reps: 8, rest: 150 },
};

const LOWER_BODY_GROUPS = new Set([
  'pierna',
  'piernas',
  'tren inferior',
  'gluteo',
  'gluteos',
  'cuadriceps',
  'isquiotibiales',
  'femorales',
  'pantorrilla',
  'pantorrillas',
  'gemelo',
  'gemelos',
  'aductor',
  'aductores',
  'abductor',
  'abductores',
]);

const LOWER_BODY_FOCUS = new Set(['pierna', 'piernas', 'tren inferior', 'lower body']);
const MAX_EXERCISES = 8;
const MAX_SESSION_SETS = 24;

function levelLabel(level: RoutineDraftLevel): string {
  if (level === 'beginner') return 'inicial';
  if (level === 'advanced') return 'avanzado';
  return 'intermedio';
}

export function normalizeIntent(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeRoutineDraftContext(context: RoutineDraftContext): RoutineDraftContext {
  if (typeof context !== 'object' || context === null) {
    throw new AppError('VALIDATION', 'Contexto de rutina inválido');
  }
  if (typeof context.goal !== 'string' || context.goal.trim().length < 2 || context.goal.length > 160) {
    throw new AppError('VALIDATION', 'El objetivo debe tener entre 2 y 160 caracteres');
  }
  if (!Array.isArray(context.focusAreas) || context.focusAreas.length > 6
    || context.focusAreas.some((area) => typeof area !== 'string' || area.trim().length < 1 || area.length > 40)) {
    throw new AppError('VALIDATION', 'Las áreas de enfoque de la rutina son inválidas');
  }
  if (context.location !== 'gym' && context.location !== 'home') {
    throw new AppError('VALIDATION', 'La ubicación de la rutina es inválida');
  }
  if (!Object.hasOwn(LEVEL_TARGETS, context.level)) {
    throw new AppError('VALIDATION', 'El nivel de la rutina es inválido');
  }
  if (!Number.isInteger(context.sessionLengthMinutes)
    || context.sessionLengthMinutes < 15 || context.sessionLengthMinutes > 180) {
    throw new AppError('VALIDATION', 'La duración debe estar entre 15 y 180 minutos');
  }
  if (context.availableEquipment !== undefined
    && (!Array.isArray(context.availableEquipment)
      || context.availableEquipment.length > 12
      || context.availableEquipment.some((item) => typeof item !== 'string' || item.trim().length < 1 || item.length > 40))) {
    throw new AppError('VALIDATION', 'El equipamiento disponible es inválido');
  }
  if (!Array.isArray(context.catalog)) {
    throw new AppError('VALIDATION', 'El catálogo de ejercicios es inválido');
  }

  return {
    ...context,
    goal: context.goal.trim().replace(/\s+/g, ' '),
    focusAreas: context.focusAreas.map((area) => area.trim()),
    availableEquipment: context.availableEquipment?.map(normalizeIntent),
  };
}

function matchesFocus(item: RoutineDraftCatalogItem, focusAreas: readonly string[]): boolean {
  if (focusAreas.length === 0) return true;
  const group = normalizeIntent(item.muscleGroup);
  return focusAreas.some((area) => {
    const focus = normalizeIntent(area);
    if (LOWER_BODY_FOCUS.has(focus)) return LOWER_BODY_GROUPS.has(group);
    return group === focus;
  });
}

function matchesKnownConstraints(
  item: RoutineDraftCatalogItem,
  context: RoutineDraftContext,
): boolean {
  if (item.availableLocations && !item.availableLocations.includes(context.location)) return false;
  if (context.availableEquipment === undefined) return true;
  if (!item.equipment) return false;

  const available = new Set(context.availableEquipment.map(normalizeIntent));
  return item.equipment.every((equipment) => available.has(normalizeIntent(equipment)));
}

export function getEligibleRoutineExercises(
  context: RoutineDraftContext,
): RoutineDraftCatalogItem[] {
  const focusAreas = context.focusAreas.map(normalizeIntent);
  const selected: RoutineDraftCatalogItem[] = [];
  const ids = new Set<number>();

  for (const item of context.catalog) {
    if (!Number.isInteger(item.id) || item.id < 1 || typeof item.name !== 'string'
      || typeof item.muscleGroup !== 'string' || ids.has(item.id)) continue;
    if (!matchesFocus(item, focusAreas) || !matchesKnownConstraints(item, context)) continue;
    ids.add(item.id);
    selected.push(item);
  }

  if (selected.length === 0) {
    const hasEquipmentMetadata = context.catalog.some((item) => item.equipment !== undefined);
    if (context.availableEquipment !== undefined && !hasEquipmentMetadata) {
      throw new AppError(
        'VALIDATION',
        'El catálogo no tiene metadatos verificados para validar el equipamiento indicado.',
      );
    }
    throw new AppError('VALIDATION', 'No hay ejercicios del catálogo compatibles con el foco y el equipamiento disponibles.');
  }
  return selected;
}

export function exerciseCountForSession(sessionLengthMinutes: number, catalogSize: number): number {
  return Math.min(catalogSize, MAX_EXERCISES, Math.max(1, Math.ceil(sessionLengthMinutes / 15)));
}

export function maxSetsForSession(sessionLengthMinutes: number): number {
  return Math.min(MAX_SESSION_SETS, Math.max(3, Math.floor(sessionLengthMinutes / 5)));
}

function addCatalogDetails(
  item: RoutineDraftCatalogItem,
  sortOrder: number,
  targets: { sets: number; reps: number },
): RoutineDraftExercise {
  return {
    exerciseId: item.id,
    exerciseName: item.name,
    muscleGroup: item.muscleGroup,
    instructions: item.instructions,
    imageUrl: item.imageUrl,
    videoUrl: item.videoUrl,
    ...(item.equipment ? { equipment: [...item.equipment] } : {}),
    sortOrder,
    targetSets: targets.sets,
    targetReps: targets.reps,
  };
}

function selectDiverseExercises(
  catalog: readonly RoutineDraftCatalogItem[],
  count: number,
): RoutineDraftCatalogItem[] {
  const selected: RoutineDraftCatalogItem[] = [];
  const usedGroups = new Set<string>();
  for (const item of catalog) {
    const group = normalizeIntent(item.muscleGroup);
    if (!usedGroups.has(group)) {
      selected.push(item);
      usedGroups.add(group);
    }
    if (selected.length === count) return selected;
  }
  for (const item of catalog) {
    if (!selected.some((selectedItem) => selectedItem.id === item.id)) selected.push(item);
    if (selected.length === count) return selected;
  }
  return selected;
}

export function buildRoutineFallback(
  context: RoutineDraftContext,
  catalog: readonly RoutineDraftCatalogItem[],
): RoutineDraft {
  const count = exerciseCountForSession(context.sessionLengthMinutes, catalog.length);
  const levelTargets = LEVEL_TARGETS[context.level];
  const sets = Math.min(levelTargets.sets, Math.floor(maxSetsForSession(context.sessionLengthMinutes) / count));
  const selected = selectDiverseExercises(catalog, count);
  const focus = context.focusAreas.length > 0 ? ` con foco en ${context.focusAreas.join(', ')}` : '';
  const location = context.location === 'home' ? 'para casa' : 'de gimnasio';

  return {
    source: 'fallback',
    name: `Coach Atlas · ${context.goal.slice(0, 36)}`,
    description: `Sesión ${location} de ${context.sessionLengthMinutes} minutos${focus} con ejercicios reales del catálogo.`,
    reason: `Atlas seleccionó ${selected.length} ejercicios del catálogo para ${context.goal}, con volumen ${levelLabel(context.level)}.`,
    kind: context.location,
    restSeconds: levelTargets.rest,
    exercises: selected.map((item, index) => addCatalogDetails(item, index, {
      sets: Math.max(1, sets),
      reps: levelTargets.reps,
    })),
  };
}
