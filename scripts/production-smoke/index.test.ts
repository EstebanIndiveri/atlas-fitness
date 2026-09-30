/**
 * @jest-environment node
 */
import { afterEach, describe, expect, it } from '@jest/globals';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SMOKE_ENV_KEYS } from './constants';
import { buildEvidence, step } from './evidence';
import { runFromEnv, writeEvidence } from './index';
import type { SmokeEvidence } from './types';

describe('runFromEnv', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it('is INCOMPLETE and writes sanitized evidence when a credential is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'atlas-smoke-'));
    dirs.push(dir);
    const evidencePath = join(dir, 'evidence.json');
    const env: Record<string, string> = {
      [SMOKE_ENV_KEYS.baseUrl]: 'https://prod.example',
      [SMOKE_ENV_KEYS.email]: 'smoke-qa@atlas.example.test',
      [SMOKE_ENV_KEYS.expectedReleaseSha]: 'abc',
      [SMOKE_ENV_KEYS.actualReleaseSha]: 'abc',
      [SMOKE_ENV_KEYS.evidencePath]: evidencePath,
      // ATLAS_SMOKE_PASSWORD intentionally missing
    };

    const result = await runFromEnv(env);

    expect(result.exitCode).toBe(2);
    expect(result.evidence.overallResult).toBe('INCOMPLETE');
    expect(result.evidence.targetResult).toEqual({
      status: 'INCOMPLETE',
      detail: 'configuration_incomplete',
    });

    const written = JSON.parse(readFileSync(evidencePath, 'utf8')) as Record<string, unknown>;
    expect(written.overallResult).toBe('INCOMPLETE');
    expect(JSON.stringify(written)).not.toContain('password');
  });

  it('refuses to persist evidence that contains a secret', () => {
    const dir = mkdtempSync(join(tmpdir(), 'atlas-smoke-'));
    dirs.push(dir);
    const evidencePath = join(dir, 'evidence.json');
    const evidence: SmokeEvidence = buildEvidence({
      qaRunId: 'LEAKEDSECRETVALUE',
      expectedReleaseSha: 'a',
      actualReleaseSha: 'a',
      deploymentId: null,
      deploymentEnvironment: null,
      deploymentUrl: null,
      workflowRunId: null,
      startedAt: 't',
      completedAt: 't',
      targetResult: step('PASS'),
      authResult: step('PASS'),
      reauthResult: step('PASS'),
      historyResult: step('PASS'),
      noteResult: step('PASS'),
      casResult: step('PASS'),
      cleanupResult: step('PASS'),
      retryAfterSeconds: null,
      recoveredOrphans: 0,
      knownQaIdentityResidualState: { longestStreak: null },
      overallResult: 'PASS',
    });

    expect(() => writeEvidence(evidence, evidencePath, ['LEAKEDSECRETVALUE'])).toThrow(
      /sensitive/i,
    );
    expect(existsSync(evidencePath)).toBe(false);
  });
});
