import { DEFAULT_CRASH_WINDOW_MS, SMOKE_ENV_KEYS } from './constants';
import { generateQaRunId, isValidQaRunId } from './run-id';
import type { ConfigLoadResult, RandomBytes, SmokeRunConfig } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reads a trimmed environment value, treating empty strings as absent. */
function read(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseBoolean(value: string): boolean {
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function parsePositiveInt(value: string, fallback: number): number {
  if (value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBaseUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** Reports the offending environment *key names* only — never their values. */
function fail(missing: string[]): ConfigLoadResult {
  return {
    ok: false,
    missing,
    message: `Missing or invalid production smoke configuration: ${missing.join(', ')}`,
  };
}

/**
 * Loads and validates runner configuration from the environment.
 *
 * Missing credentials or target identifiers produce a definitive `INCOMPLETE`
 * configuration failure before any network call. Password and email values are
 * never echoed in the failure message.
 */
export function loadSmokeConfig(
  env: Record<string, string | undefined>,
  options: { randomBytes: RandomBytes },
): ConfigLoadResult {
  const missing: string[] = [];

  const baseUrlRaw = read(env, SMOKE_ENV_KEYS.baseUrl);
  const baseUrl = normalizeBaseUrl(baseUrlRaw);
  if (!baseUrl) {
    missing.push(SMOKE_ENV_KEYS.baseUrl);
  }

  const email = read(env, SMOKE_ENV_KEYS.email);
  if (!email || !EMAIL_RE.test(email)) {
    missing.push(SMOKE_ENV_KEYS.email);
  }

  const password = env[SMOKE_ENV_KEYS.password] ?? '';
  if (password.trim().length === 0) {
    missing.push(SMOKE_ENV_KEYS.password);
  }

  const expectedReleaseSha = read(env, SMOKE_ENV_KEYS.expectedReleaseSha);
  if (expectedReleaseSha === '') {
    missing.push(SMOKE_ENV_KEYS.expectedReleaseSha);
  }

  const actualReleaseSha = read(env, SMOKE_ENV_KEYS.actualReleaseSha);
  if (actualReleaseSha === '') {
    missing.push(SMOKE_ENV_KEYS.actualReleaseSha);
  }

  const qaRunIdOverride = read(env, SMOKE_ENV_KEYS.qaRunId);
  if (qaRunIdOverride !== '' && !isValidQaRunId(qaRunIdOverride)) {
    missing.push(SMOKE_ENV_KEYS.qaRunId);
  }

  const deploymentUrlRaw = read(env, SMOKE_ENV_KEYS.deploymentUrl);
  const deploymentUrl = deploymentUrlRaw === '' ? null : normalizeBaseUrl(deploymentUrlRaw);
  if (deploymentUrlRaw !== '' && deploymentUrl === null) {
    missing.push(SMOKE_ENV_KEYS.deploymentUrl);
  }

  if (missing.length > 0 || !baseUrl) {
    return fail(missing);
  }

  const expectedHost = new URL(baseUrl).host;
  const evidencePath = read(env, SMOKE_ENV_KEYS.evidencePath) || null;
  const manifestPathRaw = read(env, SMOKE_ENV_KEYS.manifestPath);
  const manifestPath =
    manifestPathRaw !== ''
      ? manifestPathRaw
      : evidencePath !== null
        ? `${evidencePath}.manifest.json`
        : null;
  const config: SmokeRunConfig = {
    baseUrl,
    expectedHost,
    email,
    password,
    expectedReleaseSha,
    actualReleaseSha,
    deploymentId: read(env, SMOKE_ENV_KEYS.deploymentId) || null,
    deploymentEnvironment: read(env, SMOKE_ENV_KEYS.deploymentEnvironment) || null,
    deploymentUrl,
    workflowRunId: read(env, SMOKE_ENV_KEYS.workflowRunId) || null,
    qaRunId: qaRunIdOverride !== '' ? qaRunIdOverride : generateQaRunId(options.randomBytes),
    evidencePath,
    manifestPath,
    recoveryOnly: parseBoolean(read(env, SMOKE_ENV_KEYS.recoveryOnly)),
    crashWindowMs: parsePositiveInt(
      read(env, SMOKE_ENV_KEYS.crashWindowMs),
      DEFAULT_CRASH_WINDOW_MS,
    ),
  };

  return { ok: true, config };
}
