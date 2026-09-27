import { GEMINI_GENERATE_URL, GEMINI_TIMEOUT_MS, readGeminiApiKey } from './gemini';
import { parseGeminiObject } from './routine-draft-validation';
import { isRecoveryFocus, listCatalogMuscleGroups, resolveFocusAreas } from './weekly-plan-focus';
import {
  WEEKLY_PLAN_WEEKDAYS,
  type WeeklyPlanStrategyDependencies,
  type WeeklyPlanStrategyInput,
  type WeeklyPlanWeekday,
} from './weekly-plan-week-types';

const MAX_STRATEGY_FOCUS_LENGTH = 40;

/** Focus Gemini assigned to one training day before the week is assembled. */
export interface GeminiWeeklyFocusDay {
  dayOfWeek: WeeklyPlanWeekday;
  focus: string;
}

interface RawGeminiStrategyDay {
  dayOfWeek?: unknown;
  focus?: unknown;
}

function readGeminiText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const texts = parts
    .map((part) => (part && typeof part === 'object' ? (part as { text?: unknown }).text : null))
    .filter((text): text is string => typeof text === 'string' && text.trim().length > 0);
  return texts.length > 0 ? texts.join('\n') : null;
}

function buildWeeklyStrategyPrompt(
  input: WeeklyPlanStrategyInput,
  suggestedFocus: readonly string[],
): string {
  const groups = listCatalogMuscleGroups(input.catalog);
  return [
    'Sos el coach de Atlas Fitness. Definí el foco de cada día de entrenamiento de la semana.',
    'Respondé SOLO JSON válido con esta forma:',
    '{"weekPattern":[{"dayOfWeek":0,"focus":"Piernas"}]}',
    'dayOfWeek: 0 domingo, 1 lunes, 2 martes, 3 miércoles, 4 jueves, 5 viernes, 6 sábado.',
    'focus: un grupo muscular del catálogo visible, o "Movilidad y recuperación" para un día regenerativo.',
    `Cantidad exacta de días de entrenamiento: ${input.daysPerWeek}`,
    `Objetivo: ${input.goal}`,
    `Experiencia: ${input.experience}`,
    `Duración de cada sesión: ${input.sessionLengthMinutes} minutos`,
    `Equipamiento declarado: ${input.availableEquipment.join(', ') || 'sin información'}`,
    `Grupos musculares del catálogo: ${groups.join(', ')}`,
    `Enfoques a cubrir: ${suggestedFocus.join(', ')}`,
    'No repitas días de la semana. Intercalá descanso o recuperación entre sesiones y repetí un enfoque solo cuando no queden grupos disponibles.',
  ].join('\n');
}

function parseGeminiWeeklyFocusDays(
  payload: unknown,
  input: WeeklyPlanStrategyInput,
): GeminiWeeklyFocusDay[] | null {
  const pattern = (payload as { weekPattern?: unknown } | null)?.weekPattern;
  if (!Array.isArray(pattern) || pattern.length !== input.daysPerWeek) return null;

  const parsed: GeminiWeeklyFocusDay[] = [];
  const seen = new Set<WeeklyPlanWeekday>();
  for (const entry of pattern) {
    if (!entry || typeof entry !== 'object') return null;
    const { dayOfWeek, focus } = entry as RawGeminiStrategyDay;
    if (typeof dayOfWeek !== 'number' || !Number.isInteger(dayOfWeek)) return null;
    if (!WEEKLY_PLAN_WEEKDAYS.includes(dayOfWeek as WeeklyPlanWeekday)) return null;
    if (seen.has(dayOfWeek as WeeklyPlanWeekday)) return null;
    if (typeof focus !== 'string') return null;
    const label = focus.trim();
    if (!label || label.length > MAX_STRATEGY_FOCUS_LENGTH) return null;
    if (!isRecoveryFocus(label) && resolveFocusAreas(label, input.catalog).length === 0) return null;
    seen.add(dayOfWeek as WeeklyPlanWeekday);
    parsed.push({ dayOfWeek: dayOfWeek as WeeklyPlanWeekday, focus: label });
  }

  return parsed.sort((left, right) => left.dayOfWeek - right.dayOfWeek);
}

/**
 * Requests the focus of every training day from Gemini.
 *
 * @param input Weekly brief with goal, training days, focus areas and the visible catalog.
 * @param suggestedFocus Labels the deterministic distribution would use.
 * @param deps Optional fetch implementation, environment and timeout overrides.
 * @returns The Gemini focus per training day, or null when the key is missing, the request
 * fails or the answer does not describe the requested week.
 * @example
 * await requestGeminiWeeklyFocusDays(brief, ['Piernas'], { env: { GEMINI_API_KEY: '' } }); // null
 */
export async function requestGeminiWeeklyFocusDays(
  input: WeeklyPlanStrategyInput,
  suggestedFocus: readonly string[],
  deps: WeeklyPlanStrategyDependencies = {},
): Promise<GeminiWeeklyFocusDay[] | null> {
  const apiKey = readGeminiApiKey(deps.env ?? process.env);
  if (!apiKey) return null;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? GEMINI_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${GEMINI_GENERATE_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildWeeklyStrategyPrompt(input, suggestedFocus) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const text = readGeminiText(await response.json());
    if (!text) return null;
    return parseGeminiWeeklyFocusDays(parseGeminiObject(text), input);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
