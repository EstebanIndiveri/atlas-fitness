import { GEMINI_GENERATE_URL, GEMINI_TIMEOUT_MS, readGeminiApiKey } from '@/lib/ai/gemini';

/**
 * Gemini adapter that SUGGESTS a candidate YouTube technique video for an exercise.
 *
 * The suggestion is never trusted blindly: callers must validate it via
 * {@link ../exercises/video-oembed} (existence + title match) before persisting.
 * Returns null on missing key, timeout, HTTP error or invalid output so the
 * enrichment pipeline degrades to "no video" instead of a broken/wrong link.
 */

export interface GeminiExerciseVideoInput {
  name: string;
  muscleGroup?: string | null;
}

type GeminiFetch = typeof fetch;

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

/** Parses `{ "youtubeUrl": string|null }`; returns the URL string or null. */
export function parseGeminiVideoPayload(raw: string): string | null {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const value = (parsed as Record<string, unknown>).youtubeUrl;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildPrompt(input: GeminiExerciseVideoInput): string {
  const muscle = input.muscleGroup ? ` (${input.muscleGroup})` : '';
  return [
    'Sos el coach de Atlas Fitness. Devolvé SOLO JSON válido con esta forma:',
    '{"youtubeUrl": string|null}',
    'youtubeUrl: URL de un video de YouTube real y conocido que muestre la técnica correcta del ejercicio, preferentemente en español. No inventes IDs: si no estás seguro, devolvé null.',
    `Ejercicio: ${input.name}${muscle}`,
  ].join('\n');
}

/**
 * Asks Gemini for a candidate technique-video URL. Returns the raw URL string or null.
 */
export async function suggestGeminiExerciseVideo(
  input: GeminiExerciseVideoInput,
  deps: {
    fetchImpl?: GeminiFetch;
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
  } = {},
): Promise<string | null> {
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
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    const candidates = (body as { candidates?: unknown })?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }
    const first = candidates[0] as { content?: { parts?: { text?: string }[] } };
    const text = first.content?.parts?.[0]?.text;
    return typeof text === 'string' ? parseGeminiVideoPayload(text) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
