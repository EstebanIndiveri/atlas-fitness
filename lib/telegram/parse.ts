import { CALLBACK_END_WORKOUT } from '@/types/telegram';
import { isValidWeightKg } from '@/lib/format/weight';

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

export interface ParsedLogArgs {
  exerciseQuery: string;
  weightKg: string;
  reps: number;
}

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

export function parseLogArgs(text: string): ParsedLogArgs | null {
  const withoutCmd = text.replace(/^\/(?:log|serie|entreno)(?:@\w+)?\s*/i, '').trim();
  if (!withoutCmd) {
    return null;
  }

  const xMatch = withoutCmd.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*[x×]\s*(\d+)\s*$/i);
  if (xMatch) {
    const exerciseQuery = xMatch[1].trim();
    const weightKg = xMatch[2];
    const reps = Number(xMatch[3]);
    if (!exerciseQuery || !isValidWeightKg(weightKg) || reps <= 0) {
      return null;
    }
    return { exerciseQuery, weightKg, reps };
  }

  const parts = withoutCmd.split(/\s+/);
  if (parts.length < 3) {
    return null;
  }

  const repsRaw = parts[parts.length - 1];
  const weightRaw = parts[parts.length - 2];
  const exerciseQuery = parts.slice(0, -2).join(' ');
  if (!exerciseQuery || !/^\d+$/.test(repsRaw)) {
    return null;
  }

  const reps = Number(repsRaw);
  if (!isValidWeightKg(weightRaw) || reps <= 0) {
    return null;
  }

  return { exerciseQuery, weightKg: weightRaw, reps };
}
