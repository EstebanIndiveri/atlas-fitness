import type { GeminiNextExercisePayload } from '@/types/routine';

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
export const GEMINI_TIMEOUT_MS = 4000;

export function readGeminiApiKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const key = env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

export function parseGeminiNextExercisePayload(raw: string): GeminiNextExercisePayload | null {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const nextRaw = record.nextExerciseId;
  let nextExerciseId: number | null = null;
  if (typeof nextRaw === 'number' && Number.isInteger(nextRaw) && nextRaw > 0) {
    nextExerciseId = nextRaw;
  } else if (nextRaw === null) {
    nextExerciseId = null;
  } else {
    return null;
  }

  return {
    nextExerciseId,
    isLast: record.isLast === true,
    message: typeof record.message === 'string' ? record.message : '',
  };
}

export interface GeminiNextExerciseInput {
  completedExerciseName: string;
  remaining: readonly { id: number; name: string }[];
}

function buildPrompt(input: GeminiNextExerciseInput): string {
  return [
    'Sos el coach de Atlas Fitness. Respondé SOLO JSON válido con esta forma:',
    '{"nextExerciseId": number|null, "isLast": boolean, "message": string}',
    'Elegí el próximo ejercicio SOLO entre los pendientes. message: una frase corta en español rioplatense (máx 80 caracteres).',
    `Terminó: ${input.completedExerciseName}`,
    `Pendientes: ${JSON.stringify(input.remaining)}`,
    'Si no hay pendientes: nextExerciseId null e isLast true.',
  ].join('\n');
}

type GeminiFetch = typeof fetch;

/**
 * Calls Gemini generateContent. Returns null on missing key, timeout, HTTP error, or invalid JSON
 * so callers apply the deterministic routine-order fallback (ADR-003).
 */
export async function fetchGeminiNextExercise(
  input: GeminiNextExerciseInput,
  deps: {
    fetchImpl?: GeminiFetch;
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
  } = {},
): Promise<GeminiNextExercisePayload | null> {
  const key = readGeminiApiKey(deps.env);
  if (!key) {
    return null;
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? GEMINI_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${GEMINI_GENERATE_URL}?key=${encodeURIComponent(key)}`;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') {
      return null;
    }
    const candidates = (body as { candidates?: unknown }).candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }
    const first = candidates[0] as { content?: { parts?: { text?: string }[] } };
    const text = first.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      return null;
    }
    return parseGeminiNextExercisePayload(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
