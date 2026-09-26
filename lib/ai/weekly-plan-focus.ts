import type { RoutineDraftCatalogItem, RoutineDraftLocation } from './routine-draft-types';
import {
  GYM_EQUIPMENT_KEYWORDS,
  LOWER_BODY_ALIASES,
  LOWER_BODY_GROUPS,
  MAX_ENGINE_FOCUS_AREAS,
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

/**
 * Checks whether a focus label names recovery work the catalog can actually schedule.
 *
 * @param label Focus label of a strategy day or of a recovery area declaration.
 * @returns True when the label is a catalog recovery group such as core or mobility.
 * @example
 * isRecoveryGroup('Core'); // true
 */
export function isRecoveryGroup(label: string): boolean {
  const normalized = normalizeFocusLabel(label);
  return normalized.length > 0 && RECOVERY_GROUPS.has(normalized);
}

/** Lists the recovery muscle groups the caller-visible catalog exposes, in catalog order. */
export function listCatalogRecoveryGroups(
  catalog: readonly RoutineDraftCatalogItem[],
): string[] {
  return listCatalogMuscleGroups(catalog).filter((group) => isRecoveryGroup(group));
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
 * Lower body labels are collapsed first: the engine treats any lower body label as covering every
 * lower body catalog group, so the expanded groups would only spend session capacity.
 *
 * @param input Brief with the goal, the requested focus areas and the visible catalog.
 * @returns The labels that must appear in the weekly distribution.
 * @example
 * requiredFocusLabels({ goal: 'ganar fuerza', focusAreas: [], catalog }); // []
 */
export function requiredFocusLabels(input: WeeklyPlanFocusBrief): string[] {
  const requested = requestedFocusLabels(input);
  if (requested.length > 0) return collapseLowerBodyLabels(requested);
  return collapseLowerBodyLabels(
    dedupeLabels(expandLowerBodyLabels(goalFocusLabels(input.goal, input.catalog), input.catalog)),
  );
}

/**
 * Resolves the requested areas, keeping the label the user wrote instead of its expanded groups.
 *
 * A lower body area such as `Piernas` is kept as the area itself: the engine already matches it
 * against every lower body catalog group, so a split catalog without a `Piernas` group still gets
 * an honest lower body label instead of the eight groups it would expand to.
 */
function requestedFocusLabels(input: WeeklyPlanFocusBrief): string[] {
  return dedupeLabels(
    input.focusAreas.flatMap((area) => {
      const resolved = resolveFocusAreas(area, input.catalog);
      if (resolved.length === 0) return [];
      if (!isLowerBodyLabel(normalizeFocusLabel(area))) return resolved;
      const target = normalizeFocusLabel(area);
      const catalogLabel = resolved.find((label) => normalizeFocusLabel(label) === target);
      return [catalogLabel ?? area];
    }),
  );
}

/**
 * Collapses a resolved focus set to at most one lower body label, keeping brief order.
 *
 * The Routine Engine V2 matches any lower body label against every lower body catalog group (see
 * `matchesMuscleGroup`), so a set that expanded `Piernas` into the eight lower body groups of a
 * split catalog covers nothing extra while consuming eight of the six session slots.
 *
 * @param labels Resolved focus labels, in brief order.
 * @returns The same labels with the lower body represented once.
 * @example
 * collapseLowerBodyLabels(['Piernas', 'Glúteos', 'Pecho']); // ['Piernas', 'Pecho']
 */
export function collapseLowerBodyLabels(labels: readonly string[]): string[] {
  const collapsed: string[] = [];
  let seenLowerBody = false;
  for (const label of labels) {
    if (!isLowerBodyLabel(normalizeFocusLabel(label))) {
      collapsed.push(label);
      continue;
    }
    if (seenLowerBody) continue;
    seenLowerBody = true;
    collapsed.push(label);
  }
  return collapsed;
}

/** Focus coverage a weekly brief requires from the Routine Engine V2. */
export interface RequiredFocusCoverage {
  /** Required focus labels, in brief order, with the lower body represented once. */
  labels: string[];
  /** Required labels a week must cover, capped by the engine session capacity. */
  coverageThreshold: number;
  /** Note about the labels that exceed the engine capacity; empty when every label fits. */
  uncoveredNote: string;
}

/**
 * Focus labels a brief requires together with how many of them the engine can schedule.
 *
 * The engine schedules at most six focus areas per session, so a week covers at most
 * `6 × daysPerWeek` labels. The labels beyond that capacity are not a validation failure: the
 * engine simply cannot train them, and the week reports them through `uncoveredNote`.
 *
 * @param input Brief with the goal, the requested focus areas, the days and the visible catalog.
 * @returns Required labels, the coverage threshold and the capacity note.
 * @example
 * requiredFocusCoverage(brief); // { labels: ['Piernas', 'Pecho'], coverageThreshold: 2, uncoveredNote: '' }
 */
export function requiredFocusCoverage(
  input: WeeklyPlanFocusBrief & { daysPerWeek: number },
): RequiredFocusCoverage {
  const labels = requiredFocusLabels(input);
  const capacity = MAX_ENGINE_FOCUS_AREAS * Math.max(0, Math.trunc(input.daysPerWeek));
  const coverageThreshold = Math.min(labels.length, capacity);
  return {
    labels,
    coverageThreshold,
    uncoveredNote:
      coverageThreshold >= labels.length
        ? ''
        : `El motor de rutinas programa hasta ${MAX_ENGINE_FOCUS_AREAS} áreas de enfoque por sesión: la semana cubre los primeros ${coverageThreshold} de ${labels.length} focos pedidos.`,
  };
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
 * The engine matches a day focus against the catalog muscle groups, so a recovery day is only
 * scheduled when the visible catalog actually exposes recovery work (core and mobility groups).
 * A catalog without them returns no areas, so the week keeps honest training days and its rest
 * days instead of labelling a hard session as recovery.
 *
 * @param input Brief with the goal, the requested focus areas and the visible catalog.
 * @returns Visible recovery catalog labels, or an empty array when the catalog has none.
 * @example
 * recoveryFocusAreas({ goal: 'hipertrofia de piernas', focusAreas: ['Piernas'], catalog }); // ['Core']
 */
export function recoveryFocusAreas(input: WeeklyPlanFocusBrief): string[] {
  return listCatalogRecoveryGroups(input.catalog);
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
