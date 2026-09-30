import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { SMOKE_ENV_KEYS } from './constants';
import { loadSmokeConfig } from './config';
import { assertEvidenceSanitized, buildEvidence, serializeEvidence, step } from './evidence';
import { createFileManifestStore } from './manifest';
import { generateQaRunId } from './run-id';
import { runSmoke } from './runner';
import type { OverallResult, SmokeEvidence } from './types';

export interface RunFromEnvResult {
  evidence: SmokeEvidence;
  exitCode: number;
}

function exitCodeFor(overall: OverallResult): number {
  if (overall === 'PASS') {
    return 0;
  }
  return overall === 'FAIL' ? 1 : 2;
}

/**
 * Serializes evidence only after the sanitizer confirms no secret leaked.
 *
 * A detected leak throws before anything is written, so a leak can never be
 * persisted (architecture §7).
 */
export function writeEvidence(
  evidence: SmokeEvidence,
  path: string | null,
  secrets: readonly string[],
): void {
  assertEvidenceSanitized(evidence, secrets);
  const serialized = serializeEvidence(evidence);
  if (path) {
    writeFileSync(path, serialized, { encoding: 'utf8' });
  } else {
    process.stdout.write(serialized);
  }
}

/** Sanitized INCOMPLETE evidence used when configuration is missing. */
function incompleteEvidence(): SmokeEvidence {
  const now = new Date().toISOString();
  return buildEvidence({
    qaRunId: generateQaRunId((size) => randomBytes(size)),
    expectedReleaseSha: '',
    actualReleaseSha: null,
    deploymentId: null,
    deploymentEnvironment: null,
    deploymentUrl: null,
    workflowRunId: null,
    startedAt: now,
    completedAt: now,
    targetResult: step('INCOMPLETE', 'configuration_incomplete'),
    authResult: step('SKIP'),
    reauthResult: step('SKIP'),
    historyResult: step('SKIP'),
    noteResult: step('SKIP'),
    casResult: step('SKIP'),
    cleanupResult: step('SKIP'),
    retryAfterSeconds: null,
    recoveredOrphans: 0,
    knownQaIdentityResidualState: { longestStreak: null },
    overallResult: 'INCOMPLETE',
  });
}

/**
 * CLI entrypoint: loads configuration, executes the runner and emits sanitized
 * evidence. Missing configuration is INCOMPLETE and never proceeds.
 */
export async function runFromEnv(
  env: Record<string, string | undefined> = process.env,
): Promise<RunFromEnvResult> {
  const loaded = loadSmokeConfig(env, { randomBytes: (size) => randomBytes(size) });
  if (!loaded.ok) {
    const evidence = incompleteEvidence();
    const configuredPath = env[SMOKE_ENV_KEYS.evidencePath]?.trim() || null;
    writeEvidence(evidence, configuredPath, []);
    return { evidence, exitCode: 2 };
  }

  const manifestStore =
    loaded.config.manifestPath !== null
      ? createFileManifestStore(loaded.config.manifestPath)
      : undefined;
  const evidence = await runSmoke(loaded.config, {
    fetch: globalThis.fetch,
    ...(manifestStore ? { manifestStore } : {}),
  });
  writeEvidence(evidence, loaded.config.evidencePath, [loaded.config.password]);
  return { evidence, exitCode: exitCodeFor(evidence.overallResult) };
}

const entrypoint = process.argv[1] ?? '';
if (
  entrypoint.endsWith('scripts/production-smoke/index.ts') ||
  entrypoint.endsWith('scripts/production-smoke/index.js')
) {
  void runFromEnv(process.env).then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}
