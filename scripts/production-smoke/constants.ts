/** Shared constants for the production auth smoke/recovery runner. */

export const EVIDENCE_SCHEMA_VERSION = 1 as const;

/** Prefix of the durable QA run marker stored in `workout.note`. */
export const SMOKE_MARKER_PREFIX = 'ATLAS_SMOKE:';

/** Synthetic marker note (in-memory only, never written to evidence). */
export const SYNTHETIC_NOTE_PREFIX = 'ATLAS_SMOKE_NOTE:';

/** Maximum same-host redirect hops before giving up. */
export const MAX_REDIRECTS = 3;

/** Two history sets on workout A, deliberately distinct from the current set. */
export const HISTORY_SET_ONE = { setIndex: 1, reps: 8, weightKg: '42.5' } as const;
export const HISTORY_SET_TWO = { setIndex: 2, reps: 10, weightKg: '40' } as const;

/** One current set on workout B, deliberately distinct from history. */
export const CURRENT_SET = { setIndex: 1, reps: 3, weightKg: '99' } as const;

/**
 * Create-before-mark crash window: an owned, unmarked, active workout with no
 * sets created within this window is treated as the just-created orphan.
 */
export const DEFAULT_CRASH_WINDOW_MS = 5 * 60 * 1000;

/** Environment variable names consumed by `loadSmokeConfig`. */
export const SMOKE_ENV_KEYS = {
  baseUrl: 'ATLAS_SMOKE_BASE_URL',
  email: 'ATLAS_SMOKE_EMAIL',
  password: 'ATLAS_SMOKE_PASSWORD',
  expectedReleaseSha: 'ATLAS_SMOKE_EXPECTED_RELEASE_SHA',
  actualReleaseSha: 'ATLAS_SMOKE_ACTUAL_RELEASE_SHA',
  deploymentId: 'ATLAS_SMOKE_DEPLOYMENT_ID',
  deploymentEnvironment: 'ATLAS_SMOKE_DEPLOYMENT_ENVIRONMENT',
  deploymentUrl: 'ATLAS_SMOKE_DEPLOYMENT_URL',
  workflowRunId: 'ATLAS_SMOKE_WORKFLOW_RUN_ID',
  qaRunId: 'ATLAS_SMOKE_QA_RUN_ID',
  evidencePath: 'ATLAS_SMOKE_EVIDENCE_PATH',
  manifestPath: 'ATLAS_SMOKE_MANIFEST_PATH',
  recoveryOnly: 'ATLAS_SMOKE_RECOVERY_ONLY',
  crashWindowMs: 'ATLAS_SMOKE_CRASH_WINDOW_MS',
} as const;
