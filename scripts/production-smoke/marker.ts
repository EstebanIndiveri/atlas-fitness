import { SMOKE_MARKER_PREFIX, SYNTHETIC_NOTE_PREFIX } from './constants';
import type { SmokeRole } from './types';

/** Builds the durable run marker stored in `workout.note`. */
export function buildMarker(qaRunId: string, role: SmokeRole): string {
  return `${SMOKE_MARKER_PREFIX}${qaRunId}:${role}`;
}

export interface ParsedMarker {
  qaRunId: string;
  role: SmokeRole;
}

const RUN_ID_RE = /^[A-Za-z0-9_-]+$/;

/** True when a note carries the smoke marker prefix, valid or not. */
export function hasSmokePrefix(note: string | null | undefined): boolean {
  return typeof note === 'string' && note.startsWith(SMOKE_MARKER_PREFIX);
}

/**
 * Parses `ATLAS_SMOKE:<qaRunId>:<role>`.
 *
 * @returns The parsed marker or `null` when the note is not a valid marker.
 */
export function parseMarker(note: string | null | undefined): ParsedMarker | null {
  if (!hasSmokePrefix(note)) {
    return null;
  }
  const rest = (note as string).slice(SMOKE_MARKER_PREFIX.length);
  const separator = rest.lastIndexOf(':');
  if (separator <= 0 || separator >= rest.length - 1) {
    return null;
  }
  const qaRunId = rest.slice(0, separator);
  const role = rest.slice(separator + 1);
  if (!RUN_ID_RE.test(qaRunId)) {
    return null;
  }
  if (role !== 'history' && role !== 'current') {
    return null;
  }
  return { qaRunId, role };
}

/** Builds the synthetic per-exercise note text (never emitted in evidence). */
export function buildSyntheticNote(qaRunId: string): string {
  return `${SYNTHETIC_NOTE_PREFIX}${qaRunId}`;
}
