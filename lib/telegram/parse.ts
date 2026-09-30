import { CALLBACK_END_WORKOUT } from '@/types/telegram';

export const LINK_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export type BotCommand =
  | { type: 'start'; payload: string | null }
  | { type: 'help' }
  | { type: 'log'; raw: string; endAfter: boolean }
  | { type: 'summary' }
  | { type: 'reminder' }
  | { type: 'end' }
  | { type: 'link_code'; code: string }
  | { type: 'callback'; data: string }
  | { type: 'unknown'; raw: string };

/** Explicit semantic facts extracted from the capture command. Never inferred. */
export interface ParsedLogSemantics {
  loadMode: string;
  amountBasis: string | null;
  side: string;
  setPurpose: string;
  repCountBasis: string | null;
}

export interface ParsedLogArgs {
  exerciseQuery: string;
  weightKg: string;
  reps: number;
  semantics: ParsedLogSemantics;
}

/** Named semantic tokens accepted by the v0.12 capture syntax. */
const SEMANTIC_TOKEN_PATTERN = /^(mode|basis|side|purpose|repbasis)=(.*)$/i;

/**
 * Permissive amount grammar: the parser only extracts the raw string. Whether a
 * value is a valid positive load or the bodyweight zero sentinel is decided by
 * `validateSemanticCapture`, never here.
 */
const AMOUNT_PATTERN = /^\d+(?:\.\d+)?$/;

export function isLinkCode(value: string): boolean {
  return LINK_CODE_PATTERN.test(value.trim().toUpperCase());
}

function stripBotMention(text: string): string {
  return text.replace(/^(\/[a-zA-Z_]+)@\w+/, '$1');
}

export function parseMessageText(text: string): BotCommand {
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: 'unknown', raw: trimmed };
  }

  if (isLinkCode(trimmed)) {
    return { type: 'link_code', code: trimmed.toUpperCase() };
  }

  const normalized = stripBotMention(trimmed);
  const [rawCmd, ...rest] = normalized.split(/\s+/);
  const command = rawCmd.toLowerCase();
  const payload = rest.join(' ').trim();

  if (command === '/start') {
    return { type: 'start', payload: payload.length > 0 ? payload : null };
  }
  if (command === '/ayuda' || command === '/help') {
    return { type: 'help' };
  }
  if (command === '/log' || command === '/serie') {
    return { type: 'log', raw: normalized, endAfter: false };
  }
  if (command === '/entreno') {
    return { type: 'log', raw: normalized, endAfter: true };
  }
  if (command === '/resumen') {
    return { type: 'summary' };
  }
  if (command === '/recordatorio') {
    return { type: 'reminder' };
  }
  if (command === '/fin') {
    return { type: 'end' };
  }

  return { type: 'unknown', raw: trimmed };
}

export function parseCallbackData(data: string): BotCommand {
  if (data === CALLBACK_END_WORKOUT) {
    return { type: 'end' };
  }
  return { type: 'callback', data };
}

interface PositionalArgs {
  exerciseQuery: string;
  weightKg: string;
  reps: number;
}

/** Parses the exercise + amount + reps from the positional tokens only. */
function parsePositional(positional: string): PositionalArgs | null {
  if (!positional) {
    return null;
  }

  const xMatch = positional.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*[x×]\s*(\d+)\s*$/i);
  if (xMatch) {
    const exerciseQuery = xMatch[1].trim();
    const weightKg = xMatch[2];
    const reps = Number(xMatch[3]);
    if (!exerciseQuery || !AMOUNT_PATTERN.test(weightKg) || reps <= 0) {
      return null;
    }
    return { exerciseQuery, weightKg, reps };
  }

  const parts = positional.split(/\s+/);
  if (parts.length < 3) {
    return null;
  }

  const repsRaw = parts[parts.length - 1];
  const weightRaw = parts[parts.length - 2];
  const exerciseQuery = parts.slice(0, -2).join(' ');
  if (!exerciseQuery || !/^\d+$/.test(repsRaw) || !AMOUNT_PATTERN.test(weightRaw)) {
    return null;
  }

  const reps = Number(repsRaw);
  if (reps <= 0) {
    return null;
  }

  return { exerciseQuery, weightKg: weightRaw, reps };
}

/**
 * Parses a v0.12 capture command. Requires the explicit semantic tokens
 * (`mode`, `side`, `purpose`, plus `basis`/`repbasis` where the matrix demands
 * them). The legacy three-argument syntax has no semantic tokens and therefore
 * returns `null`, so the handler answers with usage instead of writing an
 * all-null unknown row. Combination validity itself stays with the domain.
 */
export function parseLogArgs(text: string): ParsedLogArgs | null {
  const withoutCmd = text.replace(/^\/(?:log|serie|entreno)(?:@\w+)?\s*/i, '').trim();
  if (!withoutCmd) {
    return null;
  }

  const positional: string[] = [];
  let loadMode: string | null = null;
  let amountBasis: string | null = null;
  let side: string | null = null;
  let setPurpose: string | null = null;
  let repCountBasis: string | null = null;

  for (const token of withoutCmd.split(/\s+/)) {
    const match = token.match(SEMANTIC_TOKEN_PATTERN);
    if (!match) {
      positional.push(token);
      continue;
    }
    const key = match[1].toLowerCase();
    const value = match[2].toLowerCase() || null;
    if (key === 'mode') loadMode = value;
    else if (key === 'basis') amountBasis = value;
    else if (key === 'side') side = value;
    else if (key === 'purpose') setPurpose = value;
    else if (key === 'repbasis') repCountBasis = value;
  }

  if (!loadMode || !side || !setPurpose) {
    return null;
  }

  const parsedPositional = parsePositional(positional.join(' '));
  if (!parsedPositional) {
    return null;
  }

  return {
    exerciseQuery: parsedPositional.exerciseQuery,
    weightKg: parsedPositional.weightKg,
    reps: parsedPositional.reps,
    semantics: { loadMode, amountBasis, side, setPurpose, repCountBasis },
  };
}
