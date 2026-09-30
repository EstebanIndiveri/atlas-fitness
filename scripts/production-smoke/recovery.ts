import { hasSmokePrefix, parseMarker } from './marker';

/** A visible, non-deleted QA-owned workout used for orphan classification. */
export interface OrphanProbe {
  id: number;
  userId: number;
  note: string | null;
  routineId: number | null;
  startedAt: string;
  endedAt: string | null;
  hasSets: boolean;
}

export type RecoveryReason = 'marked-active' | 'marked-completed' | 'crash-window';

export interface RecoveryCleanup {
  workoutId: number;
  reason: RecoveryReason;
  /** Only an active workout can have its note deleted before soft delete. */
  deleteNote: boolean;
}

export type AmbiguityReason =
  | 'unexpected-user'
  | 'unknown-marker'
  | 'unmarked-workout'
  | 'multiple-unexpected';

export interface RecoveryAmbiguity {
  workoutId: number;
  reason: AmbiguityReason;
}

export interface RecoveryPlan {
  cleanups: RecoveryCleanup[];
  ambiguous: RecoveryAmbiguity[];
}

export interface ClassifyOrphansInput {
  probes: readonly OrphanProbe[];
  activeWorkoutId: number | null;
  expectedUserId: number;
  now: Date;
  crashWindowMs: number;
}

function withinCrashWindow(startedAt: string, now: Date, windowMs: number): boolean {
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) {
    return false;
  }
  const age = now.getTime() - started;
  return age >= 0 && age <= windowMs;
}

/**
 * Deterministically classifies prior QA artifacts (architecture §6).
 *
 * Rules:
 * - An owned workout with a valid smoke marker is always recoverable.
 * - An owned, unmarked, active workout with no sets created inside the crash
 *   window is the just-created create-before-mark orphan.
 * - Anything else (foreign owner, unknown marker, unmarked/ambiguous workout,
 *   or more than one unexpected artifact) is ambiguous and must STOP cleanup.
 */
export function classifyOrphans(input: ClassifyOrphansInput): RecoveryPlan {
  const cleanups: RecoveryCleanup[] = [];
  const ambiguous: RecoveryAmbiguity[] = [];

  for (const probe of input.probes) {
    if (probe.userId !== input.expectedUserId) {
      ambiguous.push({ workoutId: probe.id, reason: 'unexpected-user' });
      continue;
    }

    const marker = parseMarker(probe.note);
    if (marker) {
      cleanups.push({
        workoutId: probe.id,
        reason: probe.endedAt === null ? 'marked-active' : 'marked-completed',
        deleteNote: probe.endedAt === null,
      });
      continue;
    }

    if (hasSmokePrefix(probe.note)) {
      ambiguous.push({ workoutId: probe.id, reason: 'unknown-marker' });
      continue;
    }

    const isCrashWindowOrphan =
      probe.endedAt === null &&
      probe.id === input.activeWorkoutId &&
      !probe.hasSets &&
      withinCrashWindow(probe.startedAt, input.now, input.crashWindowMs);
    if (isCrashWindowOrphan) {
      cleanups.push({ workoutId: probe.id, reason: 'crash-window', deleteNote: false });
      continue;
    }

    ambiguous.push({ workoutId: probe.id, reason: 'unmarked-workout' });
  }

  if (ambiguous.length > 1) {
    return {
      cleanups,
      ambiguous: ambiguous.map((entry) => ({ ...entry, reason: 'multiple-unexpected' })),
    };
  }

  return { cleanups, ambiguous };
}
