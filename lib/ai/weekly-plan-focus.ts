import type { RoutineDraftCatalogItem, RoutineDraftLocation } from './routine-draft-types';
import {
  GYM_EQUIPMENT_KEYWORDS,
  LOWER_BODY_ALIASES,
  LOWER_BODY_GROUPS,
  RECOVERY_GROUPS,
  RECOVERY_KEYWORDS,
} from './weekly-plan-focus-vocabulary';

/** Brief fields every focus label helper needs. */
interface WeeklyPlanFocusBrief {
  goal: string;
  focusAreas: readonly string[];
  catalog: readonly RoutineDraftCatalogItem[];
}

/** Lowercases, strips accents and collapses punctuation so labels can be compared. */
export function normalizeFocusLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Checks whether a focus label describes recovery work instead of muscle training.
 *
 * @param focus Focus label written by the strategy or by Gemini.
 * @returns True when the label asks for mobility, stretching or recovery.
 * @example
 * isRecoveryFocus('Movilidad y recuperación'); // true
 */
export function isRecoveryFocus(focus: string): boolean {
  const normalized = normalizeFocusLabel(focus);
  return normalized.length > 0 && RECOVERY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/** Lists the distinct muscle groups of the caller-visible catalog in catalog order. */
export function listCatalogMuscleGroups(catalog: readonly RoutineDraftCatalogItem[]): string[] {
  const groups: string[] = [];
  const seen = new Set<string>();
  for (const item of catalog) {
    if (typeof item?.muscleGroup !== 'string') continue;
    const label = item.muscleGroup.trim();
    const key = normalizeFocusLabel(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    groups.push(label);
  }
  return groups;
}

function isLowerBodyLabel(normalized: string): boolean {
  return LOWER_BODY_ALIASES.has(normalized) || LOWER_BODY_GROUPS.has(normalized);
}

/** Drops a trailing plural so `gluteo` and `gluteos` compare as the same label. */
function singularKey(label: string): string {
  return label.endsWith('s') ? label.slice(0, -1) : label;
}

/**
 * Resolves a user-facing focus label to the catalog muscle groups it covers.
 *
 * @param focusArea Label written in the brief, for example `Piernas` or `gluteos`.
 * @param catalog Caller-visible catalog used as the source of valid muscle groups.
 * @returns Matching catalog labels, or an empty array when the label is unknown or too broad.
 * @example
 * resolveFocusAreas('gluteos', catalog); // ['Glúteos']
 */
export function resolveFocusAreas(
  focusArea: string,
  catalog: readonly RoutineDraftCatalogItem[],
): string[] {
  const target = normalizeFocusLabel(focusArea);
  if (!target) return [];
  const groups = listCatalogMuscleGroups(catalog);
  const exact = groups.filter((group) => normalizeFocusLabel(group) === target);
  if (exact.length > 0) return exact;
  const targetKey = singularKey(target);
  const singular = groups.filter((group) => singularKey(normalizeFocusLabel(group)) === targetKey);
  if (singular.length > 0) return singular;
  if (!LOWER_BODY_ALIASES.has(target)) return [];
  return groups.filter((group) => LOWER_BODY_GROUPS.has(normalizeFocusLabel(group)));
}

/**
 * Checks whether an exercise muscle group belongs to a day focus.
 *
 * @param dayFocus Focus label of a training day.
 * @param muscleGroup Muscle group of a routine exercise.
 * @returns True when the exercise matches the focus, including lower body aliases.
 * @example
 * matchesMuscleGroup('piernas', 'Glúteos'); // true
 */
export function matchesMuscleGroup(dayFocus: string, muscleGroup: string): boolean {
  const focus = normalizeFocusLabel(dayFocus);
  const group = normalizeFocusLabel(muscleGroup);
  if (!focus || !group) return false;
  if (focus === group || isRecoveryFocus(dayFocus)) return true;
  return isLowerBodyLabel(focus) && LOWER_BODY_GROUPS.has(group);
}

/** Expands lower body labels to every catalog lower body group, keeping other labels as-is. */
export function expandLowerBodyLabels(
  focusAreas: readonly string[],
  catalog: readonly RoutineDraftCatalogItem[],
): string[] {
  const groups = listCatalogMuscleGroups(catalog);
  const expanded: string[] = [];
  const seen = new Set<string>();
  for (const area of focusAreas) {
    const candidates = isLowerBodyLabel(normalizeFocusLabel(area))
      ? groups.filter((group) => LOWER_BODY_GROUPS.has(normalizeFocusLabel(group)))
      : [area];
    for (const candidate of candidates) {
      const key = normalizeFocusLabel(candidate);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      expanded.push(candidate);
    }
  }
  return expanded;
}

/**
 * Derives the muscle groups named by the goal text, in catalog order.
 *
 * @param goal Free-form goal written in the brief.
 * @param catalog Caller-visible catalog used as the vocabulary.
 * @returns Catalog labels mentioned by the goal, or an empty array when the goal is open.
 * @example
 * goalFocusLabels('hipertrofia de piernas', catalog); // ['Piernas']
 */
export function goalFocusLabels(
  goal: string,
  catalog: readonly RoutineDraftCatalogItem[],
): string[] {
  const normalizedGoal = normalizeFocusLabel(goal);
  if (!normalizedGoal) return [];
  return listCatalogMuscleGroups(catalog).filter((group) =>
    normalizedGoal.includes(normalizeFocusLabel(group)),
  );
}

function dedupeLabels(labels: readonly string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const key = normalizeFocusLabel(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(label);
  }
  return unique;
}

/**
 * Focus labels a week must cover: the requested areas, or the groups named by the goal.
 *
 * @param input Brief with the goal, the requested focus areas and the visible catalog.
 * @returns The labels that must appear in the weekly distribution.
 * @example
 * requiredFocusLabels({ goal: 'ganar fuerza', focusAreas: [], catalog }); // []
 */
export function requiredFocusLabels(input: WeeklyPlanFocusBrief): string[] {
  const requested = dedupeLabels(
    input.focusAreas.flatMap((area) => resolveFocusAreas(area, input.catalog)),
  );
  if (requested.length > 0) return requested;
  return dedupeLabels(
    expandLowerBodyLabels(goalFocusLabels(input.goal, input.catalog), input.catalog),
  );
}

/**
 * Focus labels a week can train with: the requested or goal areas, otherwise every visible group.
 *
 * @param input Brief with the goal, the requested focus areas and the visible catalog.
 * @returns The labels the weekly distribution rotates over, never a fixed hardcoded split.
 * @example
 * weeklyFocusLabels({ goal: 'ganar fuerza', focusAreas: [], catalog }); // every catalog group
 */
export function weeklyFocusLabels(input: WeeklyPlanFocusBrief): string[] {
  const required = requiredFocusLabels(input);
  if (required.length > 0) return required;
  return listCatalogMuscleGroups(input.catalog);
}

/**
 * Focus areas of the recovery session scheduled when the week leaves no room for rest days.
 *
 * The engine matches a day focus against the catalog muscle groups, so a recovery day is bound to
 * the visible recovery groups (core and mobility work). A catalog without them binds the recovery
 * day to the week focus instead of letting the engine pick any muscle group of the catalog.
 *
 * @param input Brief with the goal, the requested focus areas and the visible catalog.
 * @returns Catalog labels the recovery session may select exercises from.
 * @example
 * recoveryFocusAreas({ goal: 'hipertrofia de piernas', focusAreas: ['Piernas'], catalog }); // ['Core']
 */
export function recoveryFocusAreas(input: WeeklyPlanFocusBrief): string[] {
  const recovery = listCatalogMuscleGroups(input.catalog).filter((group) =>
    RECOVERY_GROUPS.has(normalizeFocusLabel(group)),
  );
  return recovery.length > 0 ? recovery : weeklyFocusLabels(input);
}

/**
 * Infers the routine location from the equipment the user listed.
 *
 * @param equipment Equipment entries from the brief.
 * @returns `gym` when any entry looks like gym equipment, `home` otherwise.
 * @example
 * inferWeeklyLocation(['mancuernas', 'banco']); // 'gym'
 */
export function inferWeeklyLocation(equipment: readonly string[]): RoutineDraftLocation {
  const usesGymEquipment = equipment.some((item) => {
    const normalized = normalizeFocusLabel(item);
    return GYM_EQUIPMENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
  });
  return usesGymEquipment ? 'gym' : 'home';
}
