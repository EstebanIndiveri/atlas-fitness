/**
 * Type contract for the API-only production auth smoke/recovery runner.
 *
 * This module is transport-agnostic and intentionally avoids importing any
 * `app/**` or `lib/**` runtime module so the runner can be executed as a
 * standalone HTTP client. Tests may wire it to an in-process app.
 */

/** Marker role for a synthetic smoke workout. */
export type SmokeRole = 'history' | 'current';

/** Per-phase outcome recorded in evidence. */
export type StepStatus = 'PASS' | 'FAIL' | 'SKIP' | 'INCOMPLETE';

/** Sanitized per-phase result; `detail` must never contain a secret. */
export interface StepResult {
  status: StepStatus;
  detail?: string;
}

/** Aggregate run outcome. */
export type OverallResult = 'PASS' | 'FAIL' | 'INCOMPLETE';

/**
 * Accepted per-identity residual state (architecture §8).
 * `longestStreak` is recorded as non-evidence and never claimed as a product metric.
 */
export interface KnownQaIdentityResidualState {
  longestStreak: number | null;
}

/**
 * Machine-readable, sanitized evidence. Never contains a password, cookie,
 * session token, raw header, or the full synthetic note text.
 */
export interface SmokeEvidence {
  schemaVersion: 1;
  qaRunId: string;
  expectedReleaseSha: string;
  actualReleaseSha: string | null;
  deploymentId: string | null;
  deploymentEnvironment: string | null;
  deploymentUrl: string | null;
  workflowRunId: string | null;
  startedAt: string;
  completedAt: string;
  targetResult: StepResult;
  authResult: StepResult;
  reauthResult: StepResult;
  historyResult: StepResult;
  noteResult: StepResult;
  casResult: StepResult;
  cleanupResult: StepResult;
  retryAfterSeconds: number | null;
  recoveredOrphans: number;
  knownQaIdentityResidualState: KnownQaIdentityResidualState;
  overallResult: OverallResult;
}

/**
 * Fully validated runner configuration (password is kept only in memory).
 */
export interface SmokeRunConfig {
  baseUrl: string;
  expectedHost: string;
  email: string;
  password: string;
  expectedReleaseSha: string;
  actualReleaseSha: string;
  deploymentId: string | null;
  deploymentEnvironment: string | null;
  deploymentUrl: string | null;
  workflowRunId: string | null;
  qaRunId: string;
  evidencePath: string | null;
  /** Secret-free manifest path; defaults alongside the evidence file. */
  manifestPath: string | null;
  recoveryOnly: boolean;
  crashWindowMs: number;
}

/**
 * Secret-free per-run manifest (architecture §6): only non-secret ids, markers,
 * timestamps and the workflow run id. Never a password, cookie or note text.
 */
export interface SmokeManifest {
  qaRunId: string;
  expectedUserId: number;
  routineId: number | null;
  exerciseId: number | null;
  aId: number | null;
  bId: number | null;
  createdAt: string;
  workflowRunId: string | null;
}

/** Injectable persistence for the secret-free manifest (FS or in-memory). */
export interface ManifestStore {
  read: () => Promise<SmokeManifest | null>;
  write: (manifest: SmokeManifest) => Promise<void>;
  remove: () => Promise<void>;
}

/** Result of loading and validating configuration from the environment. */
export type ConfigLoadResult =
  | { ok: true; config: SmokeRunConfig }
  | { ok: false; missing: string[]; message: string };

/** Minimal request init used by the runner; avoids DOM-only type names. */
export interface SmokeRequestInit {
  method?: string;
  headers?: Headers;
  body?: string;
  redirect?: 'manual';
  signal?: AbortSignal | null;
}

/** Minimal fetch contract used by the runner (never a production-only host). */
export type FetchLike = (input: string, init?: SmokeRequestInit) => Promise<Response>;

/** Injectable CSPRNG seam (tests may pass a deterministic generator). */
export type RandomBytes = (size: number) => Uint8Array;

/** Sanitized logger: callers must only pass non-secret progress codes. */
export type Logger = (message: string) => void;

/** Parsed HTTP response with best-effort JSON body. */
export interface HttpResult<T = unknown> {
  status: number;
  text: string;
  body: T | null;
  jsonOk: boolean;
  headers: Headers;
}

/** Dependencies injected into the runner for testability. */
export interface SmokeDeps {
  fetch: FetchLike;
  now?: () => Date;
  randomBytes?: RandomBytes;
  logger?: Logger;
  /** Secret-free manifest persistence; absent = no manifest side effect. */
  manifestStore?: ManifestStore;
}
